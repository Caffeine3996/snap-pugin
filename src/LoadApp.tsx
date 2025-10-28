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
      if (operationMode !== "overwrite" && !targetFieldId) {
        return message.error("请选择写入列");
      }


      const field = await table.getField<ITextField>(selectFieldId!);
      const recordIds = await table.getRecordIdList();

      // 获取源记录（用于复制其他字段）
      let sourceRecordId: string | undefined;
      for (const id of recordIds) {
        const val = await field.getValue(id);
        if (Array.isArray(val) && val[0]?.text === selectedValue) {
          sourceRecordId = id;
          break;
        }
      }
      if (!sourceRecordId) return message.warning("未找到源记录");

      const sourceRecord = await table.getRecordById(sourceRecordId);
      const fieldData = sourceRecord.fields || {};

      if (operationMode === "add") {
        // 新增模式
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
      } else if (operationMode === "overwrite") {
        try {
          // 获取表格聚焦单元格
          const selection = await bitable.base.getSelection();
          if (!selection) {
            message.error("请先在表格中选中一个单元格");
            return;
          }
          let targetFieldId = selection.fieldId ?? undefined;
          let targetRecordId = selection.recordId ?? undefined;

          // 更新表格
          if (!targetFieldId) {
            message.error("请先在表格中选中一个单元格");
            // message.error("请选择目标字段");
            return;
          }
          const textField = await table.getField<ITextField>(targetFieldId);

          if (targetRecordId) {
            // 获取第一个选中的素材
            const firstSelected = Array.from(selectedIds)[0];
            if (!firstSelected) {
              message.warning("请选择素材");
              return;
            }

            await textField.setValue(targetRecordId, firstSelected);
            message.success("已覆盖选中素材");

          } else {
            message.error("请先在表格中选中一个单元格");
            return;
          }
        } catch (err) {
          console.error(err);
          message.error("写入失败");
        }
      } else if (operationMode === "fillEmpty") {
        // 空白补全
        const updates: { id: string; fields: Record<string, any> }[] = [];
        for (const id of recordIds) {
          const record = await table.getRecordById(id);
          const value = record.fields[targetFieldId!];
          const text = getCellText(value);
          if (!text) {
            updates.push({
              id,
              fields: { [targetFieldId!]: { type: "text", text: items[0].f_name } },
            });
          }
        }
        if (updates.length > 0) await (table as any).updateRecords(updates);
        message.success("已补全空白内容");
      }
    } catch (err) {
      console.error(err);
      message.error("写入失败");
    }
  };

  /** 关键字防抖搜索 **/
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedValue) handleCallAPI(1, pageSize, selectedValue, selectFieldId!, keyword);
    }, 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  return (
    <div className={styles.container}>
      <HeaderBar
        fieldValues={fieldValues}
        selectedValue={selectedValue || ""}
        keyword={keyword}
        selectedCount={selectedIds.size}
        operationMode={operationMode}
        onOperationModeChange={setOperationMode}
        onAccountChange={(v: string) => {
          setSelectedValue(v);
          handleCallAPI(1, pageSize, v, selectFieldId!);
        }}
        onKeywordChange={(v: string) => setKeyword(v)}
        onSettingsClick={() => {
          setTempRecordId(selectedRecordId);
          setTempTargetFieldId(targetFieldId);
          setSettingsVisible(true);
        }}
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
        onClose={() => setSettingsVisible(false)}
        onConfirm={(r: string | undefined, f: string | undefined) => {
          setSelectedRecordId(r);
          setTargetFieldId(f);
          setSettingsVisible(false);
        }}
      />
    </div>
  );
}

export default LoadApp;
