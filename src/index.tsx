import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { bitable, FieldType, ITextField } from "@lark-base-open/js-sdk";
import { Button, Select, message, Checkbox, Space, Pagination } from "antd";

function LoadApp() {
  const [info, setInfo] = useState("正在获取表格信息，请稍候...");
  const [fieldMetaList, setFieldMetaList] = useState<any[]>([]);
  const [fieldType, setFieldType] = useState<FieldType>(FieldType.Text);
  const [selectFieldId, setSelectFieldId] = useState<string>();
  const [fieldValues, setFieldValues] = useState<{ label: string; value: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState<string>();

  const [apiDataList, setApiDataList] = useState<any[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

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
          handleSelectField(defaultField.id);
        }
      } catch (err) {
        console.error(err);
        setInfo("获取表格信息失败，请检查表格或权限");
      }
    };
    init();
  }, []);

  const handleSelectField = async (fieldId: string) => {
    setSelectFieldId(fieldId);
    try {
      const table = await bitable.base.getActiveTable();
      const field = await table.getField<ITextField>(fieldId);
      const recordIds = await table.getRecordIdList();

      const values: string[] = [];
      for (const id of recordIds) {
        const val = await field.getValue(id);
        if (Array.isArray(val) && val.length > 0 && val[0].text) {
          values.push(val[0].text.trim());
        }
      }

      const uniqueValues = Array.from(new Set(values)).sort();
      setFieldValues(uniqueValues.map((v) => ({ label: v, value: v })));
    } catch (err) {
      console.error("获取字段数据失败", err);
      message.error("获取字段数据失败");
    }
  };

  const handleCallAPI = async (pageNum = page, pageSizeNum = pageSize) => {
    if (!selectedValue || !selectFieldId) {
      message.warning("请先选择字段和值");
      return;
    }

    try {
      const url = `api/feishu_interface/feishu_media.php?customerId=${selectedValue}&page=${pageNum}&pageSize=${pageSizeNum}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== 200 || !data.data?.list?.length) {
        message.warning("未获取到有效数据");
        return;
      }

      setApiDataList(data.data.list);
      setSelectedIndexes([]);
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
      const targetField = fields.find(
        (f) => f.name === "Ad Creative Media File"
      );

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
    setPage(newPage);
    handleCallAPI(newPage, pageSize);
  };

  const handlePageSizeChange = (current: number, newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    handleCallAPI(1, newPageSize);
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 10 }}>{info}</div>

      {fieldValues.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 10 }}>选择账户</div>
          <Select
            style={{ width: 220 }}
            options={fieldValues}
            value={selectedValue}
            placeholder="请选择一个账户"
            onSelect={setSelectedValue}
            getPopupContainer={(triggerNode) => triggerNode.parentElement!}
          />
        </div>
      )}

      <Button type="primary" onClick={() => handleCallAPI(page, pageSize)} style={{ marginBottom: 10 }}>
        获取数据
      </Button>

      {apiDataList.length > 0 && (
        <div>
          <Space direction="vertical" style={{ width: "100%", marginBottom: 10 }}>
            <Button
              type="primary"
              onClick={() => {
                if (selectedIndexes.length === 0) {
                  message.warning("请至少选择一项");
                  return;
                }
                const selectedItems = selectedIndexes.map((i) => apiDataList[i]);
                writeToTable(selectedItems);
              }}
            >
              写入选中数据到表格
            </Button>

            <Checkbox.Group
              value={selectedIndexes}
              onChange={(checked) => setSelectedIndexes(checked as number[])}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              {apiDataList.map((item, index) => (
                <Checkbox key={index} value={index}>
                  {item.f_name}
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Space>

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
