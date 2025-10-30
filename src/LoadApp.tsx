import React, { useEffect, useState } from "react";
import { bitable, FieldType, IRecordValue, ITextField } from "@lark-base-open/js-sdk";
import { Button, Pagination, message } from "antd";
import styles from "./index.module.css";
import HeaderBar from "./components/HeaderBar";
import MediaGrid from "./components/MediaGrid";
import PreviewModal from "./components/PreviewModal";
import SettingsDrawer from "./components/SettingsDrawer";

interface FieldOption {
  label: string;
  value: string;
}

interface RecordOption {
  id: string;
  name: string;
}

interface PreviewContent {
  type: "video" | "image";
  url: string;
  name: string;
}

function LoadApp() {
  const [info, setInfo] = useState<string>("正在获取表格信息，请稍候...");
  const [fieldMetaList, setFieldMetaList] = useState<any[]>([]);
  const [fieldValues, setFieldValues] = useState<FieldOption[]>([]);
  const [recordList, setRecordList] = useState<RecordOption[]>([]);

  const [selectFieldId, setSelectFieldId] = useState<string>();
  const [selectedValue, setSelectedValue] = useState<string>();
  const [targetFieldId, setTargetFieldId] = useState<string>();
  const [selectedRecordId, setSelectedRecordId] = useState<string>();

  const [apiDataList, setApiDataList] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [keyword, setKeyword] = useState<string>("");

  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null);
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [tempRecordId, setTempRecordId] = useState<string | undefined>();
  const [tempTargetFieldId, setTempTargetFieldId] = useState<string | undefined>();
  const [operationMode, setOperationMode] = useState<"add" | "overwrite" | "fillEmpty">("add");

  /** 安全获取字段文本 **/
  const getCellText = (cell: any): string => {
    if (Array.isArray(cell)) {
      const first = cell[0];
      if (typeof first === "object" && first !== null && "text" in first) {
        return first.text;
      }
      return String(first);
    }
    return String(cell ?? "");
  };
  /** ✅ 1️⃣ 初始化时读取本地存储配置 **/
  useEffect(() => {
    const savedConfig = localStorage.getItem("mediaWriterConfig");
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setSelectedRecordId(parsed.recordId);
        setTargetFieldId(parsed.fieldId);
        setOperationMode(parsed.operationMode || "add");
      } catch (err) {
        console.warn("读取本地配置失败：", err);
      }
    }
  }, []);

  /** 初始化表格信息 **/
  useEffect(() => {
    const init = async () => {
      try {
        const table = await bitable.base.getActiveTable();
        const fields = await table.getFieldMetaList();
        setFieldMetaList(fields);

        const defaultField = fields.find((f) => f.type === FieldType.Text && f.name === "广告账户");
        if (!defaultField) return;

        setSelectFieldId(defaultField.id);
        const field = await table.getField<ITextField>(defaultField.id);
        const recordIds = await table.getRecordIdList();

        const values: string[] = [];
        for (const id of recordIds) {
          const val = await field.getValue(id);
          if (Array.isArray(val) && val[0]?.text) values.push(val[0].text.trim());
        }

        const options = Array.from(new Set(values)).sort().map((v) => ({ label: v, value: v }));
        setFieldValues(options);

        // 记录列表
        const recordOptions: RecordOption[] = [];
        for (const id of recordIds) {
          const record = await table.getRecordById(id);
          const value = record.fields[defaultField.id];
          const name = getCellText(value) || `记录 ${id}`;
          recordOptions.push({ id, name });
        }
        setRecordList(recordOptions);

        if (options.length > 0) {
          setSelectedValue(options[0].value);
          handleCallAPI(1, pageSize, options[0].value, defaultField.id);
        }
      } catch (e) {
        console.error(e);
        setInfo("获取表格信息失败");
      }
    };
    init();
  }, []);

  /** 调接口 **/
  const handleCallAPI = async (
    pageNum: number = page,
    pageSizeNum: number = pageSize,
    accountValue: string = selectedValue!,
    fieldId: string = selectFieldId!,
    keywordValue: string = keyword
  ) => {
    if (!accountValue || !fieldId) return;
    try {
      const url = `https://new.inmad.cn/feishu_interface/feishu_media.php?customerId=${accountValue}&page=${pageNum}&pageSize=${pageSizeNum}&name=${encodeURIComponent(keywordValue)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 200 || !data.data?.list?.length) {
        setApiDataList([]);
        setTotal(0);
        return;
      }
      setApiDataList(data.data.list);
      setTotal(data.data.total);
      setPage(pageNum);
    } catch (err) {
      message.error("接口调用失败");
    }
  };

  /** 写入表格 **/
  const writeToTable = async (items: { f_name: string }[]) => {
    try {
      const table = await bitable.base.getActiveTable();

      switch (operationMode) {
        case "add":
          await handleAddMode(table, items);
          break;
        case "overwrite":
          await handleOverwriteMode(table);
          break;
        case "fillEmpty":
          await handleFillEmptyMode(table);
          break;
        default:
          message.error("未知的操作模式");
      }
    } catch (err) {
      console.error(err);
      message.error("写入失败");
    }
  };

  /** ========== 各模式实现 ========== **/

  // Add 模式：复制源记录并新增
  const handleAddMode = async (table: any, items: { f_name: string }[]) => {
    if (!targetFieldId) return message.error("请选择写入列");

    const field = await table.getField(selectFieldId!);
    const recordIds = await table.getRecordIdList();
    if (!selectedValue) {
      message.error("请先选择一个源值");
      return;
    }

    const sourceRecordId = await findSourceRecordId(table, field, selectedValue);
    if (!sourceRecordId) return message.warning("未找到源记录");

    const sourceRecord = await table.getRecordById(sourceRecordId);
    const fieldData = sourceRecord.fields || {};

    const newRecords: IRecordValue[] = items.map((i) => {
      const fields: Record<string, any> = {};
      for (const key in fieldData) {
        const value = fieldData[key];
        fields[key] = typeof value === "string" ? { type: "text", text: value } : value;
      }
      fields[targetFieldId!] = { type: "text", text: i.f_name };
      return { fields };
    });

    await table.addRecords(newRecords);
    message.success(`已创建 ${newRecords.length} 条记录`);
  };

  // Overwrite 模式：覆盖选中单元格
  const handleOverwriteMode = async (table: any) => {
    const selection = await bitable.base.getSelection();
    if (!selection?.fieldId || !selection?.recordId) {
      return message.error("请先在表格中选中一个单元格");
    }

    const textField = await table.getField(selection.fieldId);
    const firstSelected = Array.from(selectedIds)[0];
    if (!firstSelected) return message.warning("请选择素材");

    await textField.setValue(selection.recordId, firstSelected);
    message.success("已覆盖选中素材");
  };

  // FillEmpty 模式：填充空白单元格
  const handleFillEmptyMode = async (table: any) => {
    const selection = await bitable.base.getSelection();
    if (!selection?.fieldId) {
      return message.error("请先选中一个单元格所在列");
    }

    const textField = await table.getField(selection.fieldId);
    const recordIds = await table.getRecordIdList();
    const selectedArray = Array.from(selectedIds);
    if (selectedArray.length === 0) return message.warning("请选择至少一个素材");

    let filledCount = 0;
    let index = 0;

    for (const recordId of recordIds) {
      const currentValue = await textField.getValue(recordId);
      const isEmpty =
        !currentValue ||
        (Array.isArray(currentValue) && (!currentValue.length || !currentValue[0]?.text));

      if (isEmpty) {
        const currentMaterial = selectedArray[index % selectedArray.length];
        await textField.setValue(recordId, currentMaterial);
        filledCount++;
        index++;
      }
    }

    message.success(`已依次填充 ${filledCount} 条空白记录`);
  };

  // 辅助函数
  const findSourceRecordId = async (table: any, field: ITextField, selectedValue: string) => {
    const recordIds = await table.getRecordIdList();
    for (const id of recordIds) {
      const val = await field.getValue(id);
      if (Array.isArray(val) && val[0]?.text === selectedValue) {
        return id;
      }
    }
    return undefined;
  };



  /** 关键字防抖搜索 **/
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedValue) handleCallAPI(1, pageSize, selectedValue, selectFieldId!, keyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);
  /** ✅ 2️⃣ 点击确定时保存本地配置 **/
  const handleConfirmSettings = (
    recordId: string,
    fieldId: string,
    mode: "add" | "overwrite" | "fillEmpty"
  ) => {
    setSelectedRecordId(recordId);
    setTargetFieldId(fieldId);
    setOperationMode(mode);
    setSettingsVisible(false);

    // 保存配置到 localStorage
    localStorage.setItem(
      "mediaWriterConfig",
      JSON.stringify({
        recordId,
        fieldId,
        operationMode: mode,
      })
    );
  };

  /** 打开设置抽屉 **/
  const handleOpenSettings = () => {
    setTempRecordId(selectedRecordId);

    setTempTargetFieldId(targetFieldId);
    setSettingsVisible(true);
  };
  return (
    <div className={styles.container}>
      <HeaderBar
        fieldValues={fieldValues}
        selectedValue={selectedValue || ""}
        keyword={keyword}
        selectedCount={selectedIds.size}
        onAccountChange={(v: string) => {
          setSelectedValue(v);
          handleCallAPI(1, pageSize, v, selectFieldId!);
        }}
        onKeywordChange={(v: string) => setKeyword(v)}
        onSettingsClick={handleOpenSettings}
        onClearSelected={() => setSelectedIds(new Set())}
      />

      <MediaGrid
        dataList={apiDataList}
        selectedIds={selectedIds}
        onToggleSelect={(name: string, checked: boolean) =>
          setSelectedIds((prev) => {
            const s = new Set(prev);
            checked ? s.add(name) : s.delete(name);
            return s;
          })
        }
        onPreview={(item: { f_name: string; f_path: string }) => {
          const isVideo = item.f_name?.endsWith(".mp4");
          setPreviewContent({ type: isVideo ? "video" : "image", url: item.f_path, name: item.f_name });
          setPreviewVisible(true);
        }}
      />

      {apiDataList.length > 0 && (
        <div className={styles.footer}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            onChange={(p, size) => handleCallAPI(p, size)}
          />
          <Button
            type="primary"
            onClick={() => {
              if (selectedIds.size === 0) return message.warning("请选择素材");
              writeToTable(Array.from(selectedIds).map((name) => ({ f_name: name })));
            }}
          >
            写入选中数据到表格
          </Button>
        </div>
      )}

      <PreviewModal visible={previewVisible} content={previewContent} onClose={() => setPreviewVisible(false)} />
      <SettingsDrawer
        visible={settingsVisible}
        recordList={recordList}
        fieldMetaList={fieldMetaList}
        tempRecordId={tempRecordId}
        tempTargetFieldId={tempTargetFieldId}
        tempOperationMode={operationMode}
        onClose={() => setSettingsVisible(false)}
        onConfirm={handleConfirmSettings}
      />


    </div>
  );
}

export default LoadApp;
