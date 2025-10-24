import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { bitable, FieldType, ITextField } from "@lark-base-open/js-sdk";
import { Button, Select, message, Checkbox, Pagination, Tooltip } from "antd";
import styles from "./index.module.css";
import { CloseOutlined, PlayCircleOutlined } from "@ant-design/icons";
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
    fieldId = selectFieldId
  ) => {
    if (!accountValue || !fieldId) {
      message.warning("请先选择字段和值");
      return;
    }

    try {
      const url = `api/feishu_interface/feishu_media.php?customerId=${accountValue}&page=${pageNum}&pageSize=${pageSizeNum}`;
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
      const targetField = fields.find((f) => f.name === "Ad Creative Media File");

      if (!targetField) {
        message.error("未找到列：Ad Creative Media File");
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
        newFields[targetField.id] = [{ type: "text", text: item.f_name }];
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

  const handlePlayVideo = (item: any) => {
    window.open(item.f_path, "_blank");
  };
  // 新增方法
  const handleWriteSelectedToTable = async () => {
    if (selectedIds.size === 0) {
      message.warning("请至少选择一项");
      return;
    }

    // 这里直接用 selectedIds 创建 items，如果只需要 f_name
    const selectedItems = Array.from(selectedIds).map((name) => ({ f_name: name }));

    await writeToTable(selectedItems);
  };
  return (
    <div className={styles.container}>
      {/* 选择账户 */}
      {fieldValues.length > 0 && (
        <div className={styles.selectWrapper}>
          <div>选择账户</div>
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
          {/* 只有有选中素材才显示 */}
          {selectedIds.size > 0 && (
            <div >
              <Button
                type="primary"

              >
                已经选择{selectedIds.size} 个素材
                <CloseOutlined
                  style={{ marginLeft: 8 }}
                  onClick={(e) => {
                    e.stopPropagation(); // 阻止冒泡
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
      
                  <PlayCircleOutlined
                    className={styles.playIcon}
                    onClick={() => handlePlayVideo(item)}
                   
                  />
             
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
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LoadApp />
  </React.StrictMode>
);
