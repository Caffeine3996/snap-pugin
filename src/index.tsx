import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { bitable, FieldType, ITextField } from "@lark-base-open/js-sdk";
import {
  Button,
  Select,
  message,
  Checkbox,
  Pagination,
  Tooltip,
  Drawer,
  Input,
  Form,
  Modal
} from "antd";
import styles from "./index.module.css";
import { CloseOutlined, PlayCircleOutlined, SettingOutlined } from "@ant-design/icons";

function LoadApp() {
  const [info, setInfo] = useState("正在获取表格信息，请稍候...");
  const [fieldMetaList, setFieldMetaList] = useState<any[]>([]);
  const [selectFieldId, setSelectFieldId] = useState<string>();
  const [fieldValues, setFieldValues] = useState<{ label: string; value: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState<string>();

  const [apiDataList, setApiDataList] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ type: "video" | "image"; url: string; name: string } | null>(null);
  const [keyword, setKeyword] = useState<string>("");

  // 主状态：源记录和写入列
  const [targetFieldId, setTargetFieldId] = useState<string>();
  const [recordList, setRecordList] = useState<{ id: string; name: string }[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string>();
  const [settingsVisible, setSettingsVisible] = useState(false);

  // 临时状态：抽屉内选择
  const [tempRecordId, setTempRecordId] = useState<string | undefined>();
  const [tempTargetFieldId, setTempTargetFieldId] = useState<string | undefined>();

  useEffect(() => {
    const init = async () => {
      try {
        const table = await bitable.base.getActiveTable();
        const tableName = await table.getName();
        setInfo(`表格名称：${tableName}`);

        const fields = await table.getFieldMetaList();
        setFieldMetaList(fields);

        const defaultField = fields.find(
          (f) => f.type === FieldType.Text && f.name === "广告账户"
        );

        if (defaultField) {
          setSelectFieldId(defaultField.id);
          const field = await table.getField<ITextField>(defaultField.id);
          const recordIds = await table.getRecordIdList();

          const values: string[] = [];
          for (const id of recordIds) {
            const val = await field.getValue(id);
            if (Array.isArray(val) && val.length > 0 && val[0].text) {
              values.push(val[0].text.trim());
            }
          }

          const uniqueValues = Array.from(new Set(values)).sort();
          const options = uniqueValues.map((v) => ({ label: v, value: v }));
          setFieldValues(options);

          const adIdField = fields.find((f) => f.name === "广告账户");
          const adIdFieldId = adIdField?.id;

          const recordOptions: { id: string; name: string }[] = [];
          for (const id of recordIds) {
            const record = await table.getRecordById(id);
            if (record) {
              const adIdValue = adIdFieldId ? record.fields[adIdFieldId]?.[0]?.text : undefined;
              recordOptions.push({
                id,
                name: adIdValue || `记录 ${id}`,
              });
            }
          }
          setRecordList(recordOptions);
          if (recordOptions.length > 0) setSelectedRecordId(recordOptions[0].id);

          if (options.length > 0) {
            setSelectedValue(options[0].value);
            handleCallAPI(1, pageSize, options[0].value, defaultField.id);
          }
        }
      } catch (err) {
        console.error(err);
        setInfo("获取表格信息失败，请检查表格或权限");
      }
    };
    init();
  }, []);

  const handleCallAPI = async (
    pageNum = page,
    pageSizeNum = pageSize,
    accountValue = selectedValue,
    fieldId = selectFieldId,
    keywordValue = keyword
  ) => {
    if (!accountValue || !fieldId) {
      message.warning("请先选择字段和值");
      return;
    }

    try {
      const url = `api/feishu_interface/feishu_media.php?customerId=${accountValue}&page=${pageNum}&pageSize=${pageSizeNum}&name=${encodeURIComponent(keywordValue)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== 200 || !data.data?.list?.length) {
        setApiDataList([]);
        setTotal(0);
        message.warning("未获取到有效数据");
        return;
      }

      setApiDataList(data.data.list);
      setTotal(data.data.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error("接口调用失败", err);
      message.error("接口调用失败");
    }
  };

  const writeToTable = async (items: any[]) => {
    try {
      const table = await bitable.base.getActiveTable();
      const fields = await table.getFieldMetaList();

      if (!targetFieldId) {
        message.error("请先选择要写入的列");
        return;
      }

      const targetField = fields.find((f) => f.id === targetFieldId);
      if (!targetField) {
        message.error("未找到目标列");
        return;
      }

      if (!selectFieldId || !selectedValue) {
        message.error("缺少选择字段或字段值");
        return;
      }

      const recordIds = await table.getRecordIdList();
      const field = await table.getField<ITextField>(selectFieldId);

      let sourceRecordId: string | undefined;
      for (const id of recordIds) {
        const val = await field.getValue(id);
        if (Array.isArray(val) && val[0]?.text?.trim() === selectedValue) {
          sourceRecordId = id;
          break;
        }
      }

      if (!sourceRecordId) {
        message.warning(`未找到字段值为「${selectedValue}」的源记录`);
        return;
      }

      const sourceRecord = await table.getRecordById(sourceRecordId);
      if (!sourceRecord) {
        message.error("无法获取源记录数据");
        return;
      }

      const fieldData = sourceRecord.fields || {};
      const newRecords = items.map((item) => {
        const newFields: any = { ...fieldData };
        newFields[targetFieldId] = [{ type: "text", text: item.f_name }];
        return { fields: newFields };
      });

      await table.addRecords(newRecords);
      message.success(`成功创建 ${newRecords.length} 条新记录`);
    } catch (err) {
      console.error("创建新记录失败", err);
      message.error("创建新记录失败");
    }
  };

  const handlePageChange = (newPage: number) => {
    handleCallAPI(newPage, pageSize);
  };

  const handlePageSizeChange = (current: number, newPageSize: number) => {
    setPageSize(newPageSize);
    handleCallAPI(1, newPageSize);
  };

  const handlePreview = (item: any) => {
    const isVideo = item.f_name?.endsWith(".mp4") || item.f_path?.endsWith(".mov");
    setPreviewContent({ type: isVideo ? "video" : "image", url: item.f_path, name: item.f_name });
    setPreviewVisible(true);
  };

  const handleWriteSelectedToTable = async () => {
    if (selectedIds.size === 0) {
      message.warning("请至少选择一项");
      return;
    }
    const selectedItems = Array.from(selectedIds).map((name) => ({ f_name: name }));
    await writeToTable(selectedItems);
  };

  // 输入变化时自动触发搜索（防抖）
  useEffect(() => {
    const handler = setTimeout(() => {
      if (selectedValue) {
        handleCallAPI(1, pageSize, selectedValue, selectFieldId, keyword);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [keyword]);

  return (
    <div className={styles.container}>
      {/* 选择账户 */}
      {fieldValues.length > 0 && (
        <div className={styles.selectWrapper}>
          <Select
            style={{ width: 220 }}
            options={fieldValues}
            value={selectedValue}
            placeholder="请选择一个账户"
            onChange={(value) => {
              setSelectedValue(value);
              handleCallAPI(1, pageSize, value, selectFieldId);
            }}
            getPopupContainer={(triggerNode) => triggerNode.parentElement!}
          />
          <Input
            placeholder="输入关键字搜索"
            value={keyword}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
          />
          <SettingOutlined
            style={{ fontSize: 16,  cursor: "pointer" }}
            onClick={() => {
              setTempRecordId(selectedRecordId);
              setTempTargetFieldId(targetFieldId);
              setSettingsVisible(true);
            }}
          />
          {selectedIds.size > 0 && (
            <div>
              <Button type="primary">
                选{selectedIds.size}个素材
                <CloseOutlined
                  style={{ marginLeft: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIds(new Set());
                  }}
                />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 网格卡片展示 */}
      {apiDataList.length > 0 && (
        <div className={styles.scrollArea}>
          <div className={styles.gridContainer}>
            {apiDataList.map((item) => (
              <div key={item.back_key_id} className={styles.card}>
                <Checkbox
                  className={styles.checkbox}
                  checked={selectedIds.has(item.f_name)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedIds((prev) => {
                      const newSet = new Set(prev);
                      if (checked) newSet.add(item.f_name);
                      else newSet.delete(item.f_name);
                      return newSet;
                    });
                  }}
                />
                <img src={item.f_thumbnail} alt={item.f_name} className={styles.img} />
                <PlayCircleOutlined className={styles.playIcon} onClick={() => handlePreview(item)} />
                <div className={styles.nameInfo}>
                  <Tooltip title={item.f_name}>
                    <div className={styles.name}>
                      <span>{item.f_name}</span>
                    </div>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部固定区域 */}
      {apiDataList.length > 0 && (
        <div className={styles.footer}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            pageSizeOptions={[10, 20, 50]}
            showSizeChanger
            onChange={(pageNum, newPageSize) => {
              if (newPageSize !== pageSize) {
                handlePageSizeChange(pageNum, newPageSize);
              } else {
                handlePageChange(pageNum);
              }
            }}
          />
          <Button type="primary" onClick={handleWriteSelectedToTable}>
            写入选中数据到表格
          </Button>
        </div>
      )}

      {/* 预览 Modal */}
      <Modal
        open={previewVisible}
        footer={null}
        title={
          <Tooltip title={previewContent?.name}>
            <div style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {previewContent?.name || "未知文件名"}
            </div>
          </Tooltip>
        }
        onCancel={() => setPreviewVisible(false)}
        width={360}
      >
        <div style={{ paddingTop: 30 }}>
          {previewContent?.type === "video" ? (
            <video src={previewContent.url} controls width="100%" height="450px" onError={() => message.error("视频无法播放，请检查链接或格式")} />
          ) : (
            <img src={previewContent?.url} alt="preview" style={{ width: "100%", height: 400, objectFit: "contain" }} />
          )}
        </div>
      </Modal>

      {/* 设置 Drawer */}
      <Drawer
        title="选择源记录与写入列"
        placement="right"
        width={360}
        onClose={() => setSettingsVisible(false)}
        open={settingsVisible}
        footer={
          <div style={{ textAlign: "right" }}>
            <Button style={{ marginRight: 8 }} onClick={() => setSettingsVisible(false)}>取消</Button>
            <Button
              type="primary"
              onClick={() => {
                setSelectedRecordId(tempRecordId);
                setTargetFieldId(tempTargetFieldId);
                setSettingsVisible(false);
              }}
            >
              确定
            </Button>
          </div>
        }
      >
        <Form layout="horizontal" colon={false}>
          <Form.Item label="源记录">
            <Select
              showSearch
              placeholder="请选择源记录"
              value={tempRecordId}
              onChange={(value) => setTempRecordId(value)}
              options={recordList.map((r) => ({ label: r.name, value: r.id }))}
              getPopupContainer={(triggerNode) => triggerNode.parentElement!}
            />
          </Form.Item>
          <Form.Item label="写入列">
            <Select
              showSearch
              placeholder="请选择写入列"
              value={tempTargetFieldId}
              onChange={(value) => setTempTargetFieldId(value)}
              options={fieldMetaList.map((f) => ({ label: f.name, value: f.id }))}
              getPopupContainer={(triggerNode) => triggerNode.parentElement!}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LoadApp />
  </React.StrictMode>
);
