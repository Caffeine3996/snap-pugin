import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { bitable, FieldType, ITextField } from "@lark-base-open/js-sdk";
import { Alert, Button, Select, message, Checkbox } from "antd";

// ====== 主组件 ======
function LoadApp() {
  const [info, setInfo] = useState("正在获取表格信息，请稍候...");
  const [alertType, setAlertType] = useState<"info" | "success" | "error">("info");
  const [fieldMetaList, setFieldMetaList] = useState<any[]>([]);

  // 默认字段类型 = 单行文本字段
  const [fieldType, setFieldType] = useState<FieldType>(FieldType.Text);

  const [selectFieldId, setSelectFieldId] = useState<string>();
  const [fieldValues, setFieldValues] = useState<{ label: string; value: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState<string>();

  // 接口数据展示相关
  const [apiDataList, setApiDataList] = useState<any[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const table = await bitable.base.getActiveTable();
        const tableName = await table.getName();
        setInfo(`表格名称：${tableName}`);
        setAlertType("success");

        const fields = await table.getFieldMetaList();
        setFieldMetaList(fields);

        // 初始化时自动选择名称为“广告账户”的字段
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
        setAlertType("error");
      }
    };
    init();
  }, []);

  // 获取指定字段唯一值
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

  // 格式化字段列表
  const formatFieldList = () => {
    if (!fieldType) return [];
    return fieldMetaList
      .filter((f) => f.type === fieldType)
      .map((f) => ({ label: f.name, value: f.id }));
  };

  // 调用接口并显示数据
  const handleCallAPI = async () => {
    if (!selectedValue || !selectFieldId) {
      message.warning("请先选择字段和值");
      return;
    }

    try {
      const url = `api/feishu_interface/feishu_media.php?customerId=${selectedValue}&name=`;
      // const url = `https://new.inmad.cn/feishu_interface/feishu_media.php?customerId=${selectedValue}&name=`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== 200 || !data.data?.list?.length) {
        message.warning("未获取到有效数据");
        return;
      }

      const list = data.data.list;
      setApiDataList(list); // 保存接口数据
      setSelectedIndexes([]); // 重置勾选
    } catch (err) {
      console.error("接口调用失败", err);
      message.error("接口调用失败");
    }
  };

  // 写入新行（复制原字段值 + 新的 Ad Creative Media File）
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

  return (
    <div style={{ padding: 20 }}>
      {/* <Alert message={info} type={alertType} style={{ marginBottom: 20 }} /> */}

      {/* <div style={{ marginBottom: 10 }}>
        <div>选择字段类型</div>
        <Select
          style={{ width: 220 }}
          value={fieldType}
          onSelect={(val: FieldType) => {
            setFieldType(val);
            setSelectFieldId(undefined);
            setFieldValues([]);
          }}
          options={[
            { label: "货币字段", value: FieldType.Currency },
            { label: "单行文本字段", value: FieldType.Text },
          ]}
        />
      </div>

      {fieldType && (
        <div style={{ marginBottom: 10 }}>
          <div>选择字段</div>
          <Select
            style={{ width: 220 }}
            value={selectFieldId}
            onSelect={handleSelectField}
            options={formatFieldList()}
            placeholder="请选择字段"
          />
        </div>
      )} */}

      {fieldValues.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div>选择字段值</div>
          <Select
            style={{ width: 220 }}
            options={fieldValues}
            value={selectedValue}
            placeholder="请选择一个字段值"
            onSelect={setSelectedValue}
            getPopupContainer={(triggerNode) => triggerNode.parentElement!}
          />
        </div>
      )}

      <Button type="primary" onClick={handleCallAPI}>
        调用接口并显示数据
      </Button>

      {/* ===== 页面下方展示接口数据 ===== */}
      {apiDataList.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 10, fontWeight: "bold" }}>接口返回数据：</div>
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
          <Button
            type="primary"
            style={{ marginTop: 10 }}
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
        </div>
      )}
    </div>
  );
}

// ====== 渲染到页面 ======
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LoadApp />
  </React.StrictMode>
);
