import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { bitable, FieldType, ITextField } from "@lark-base-open/js-sdk";
import { Alert, Button, Select, Modal, message, Checkbox } from "antd";

// ====== 主组件 ======
function LoadApp() {
  const [info, setInfo] = useState("正在获取表格信息，请稍候...");
  const [alertType, setAlertType] = useState<"info" | "success" | "error">(
    "info"
  );
  const [fieldMetaList, setFieldMetaList] = useState<any[]>([]);
  const [fieldType, setFieldType] = useState<FieldType | "">("");
  const [selectFieldId, setSelectFieldId] = useState<string>();
  const [fieldValues, setFieldValues] = useState<
    { label: string; value: string }[]
  >([]);
  const [selectedValue, setSelectedValue] = useState<string>();

  useEffect(() => {
    const init = async () => {
      try {
        const table = await bitable.base.getActiveTable();
        const tableName = await table.getName();
        setInfo(`表格名称：${tableName}`);
        setAlertType("success");

        const fields = await table.getFieldMetaList();
        setFieldMetaList(fields);
      } catch (err) {
        console.error(err);
        setInfo("获取表格信息失败，请检查表格或权限");
        setAlertType("error");
      }
    };
    init();
  }, []);

  // ✅ 过滤指定类型字段
  const formatFieldList = () => {
    if (!fieldType) return [];
    return fieldMetaList
      .filter((f) => f.type === fieldType)
      .map((f) => ({ label: f.name, value: f.id }));
  };

  // ✅ 选择字段后获取唯一值
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

      // 去重 + 排序
      const uniqueValues = Array.from(new Set(values)).sort();
      setFieldValues(uniqueValues.map((v) => ({ label: v, value: v })));
    } catch (err) {
      console.error("获取字段数据失败", err);
      message.error("获取字段数据失败");
    }
  };

  // ✅ 点击调用 API 并多选写入
  const handleCallAPI = async () => {
    if (!selectedValue || !selectFieldId) {
      message.warning("请先选择字段和值");
      return;
    }

    try {
      const url = `/api/feishu_interface/feishu_media.php?customerId=${selectedValue}&name=`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== 200 || !data.data?.list?.length) {
        message.warning("未获取到有效数据");
        return;
      }

      const list = data.data.list;
      const options = list.map((item: any, index: number) => ({
        label: `${item.f_name}`,
        value: index,
      }));

      let selectedIndexes: number[] = [];

      // ✅ 弹窗选择
      Modal.confirm({
        title: "请选择要写入表格的数据",
        width: 600,
        content: (
          <div style={{ maxHeight: 300, overflowY: "auto", marginTop: 10 }}>
            <Checkbox.Group
              options={options}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
              onChange={(checked) => {
                selectedIndexes = checked as number[];
              }}
            />
          </div>
        ),
        okText: "确定写入",
        cancelText: "取消",
        async onOk() {
          if (selectedIndexes.length === 0) {
            message.warning("请至少选择一项");
            return;
          }

          const selectedItems = selectedIndexes.map((i) => list[i]);
          await writeToTable(selectedItems);
        },
      });
    } catch (err) {
      console.error("接口调用失败", err);
      message.error("接口调用失败");
    }
  };

  // ✅ 将选中项写入表格
  // ✅ 将选中项写入表格（写入到“Ad Creative Media File”列）
  // ✅ 将选中项写入表格（写入到“Ad Creative Media File”列 + 当前选择字段列）
  // ✅ 在新行中写入：复制原字段值 + 新的 Ad Creative Media File
  const writeToTable = async (items: any[]) => {
    try {
      const table = await bitable.base.getActiveTable();
      const fields = await table.getFieldMetaList();

      // 找目标列
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

      // ✅ 获取表中所有记录
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

      // ✅ 读取该源记录的所有字段数据
      const sourceRecord = await table.getRecordById(sourceRecordId);
      if (!sourceRecord) {
        message.error("无法获取源记录数据");
        return;
      }

      // ✅ 过滤掉系统字段
      const fieldData = sourceRecord.fields || {};

      // ✅ 构造新行记录（复制原数据 + 新 media 文件）
      const newRecords = items.map((item) => {
        const newFields: any = { ...fieldData };

        // 覆盖 “Ad Creative Media File” 列
        newFields[targetField.id] = [
          {
            type: "text",
            text: item.f_name,
          },
        ];

        return { fields: newFields };
      });

      // ✅ 批量添加新行
      await table.addRecords(newRecords);
      message.success(`成功创建 ${newRecords.length} 条新记录`);
    } catch (err) {
      console.error("创建新记录失败", err);
      message.error("创建新记录失败");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Alert message={info} type={alertType} style={{ marginBottom: 20 }} />

      <div style={{ marginBottom: 10 }}>
        <div>选择字段类型</div>
        <Select
          style={{ width: 220 }}
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
            onSelect={handleSelectField}
            options={formatFieldList()}
            placeholder="请选择字段"
          />
        </div>
      )}

      {fieldValues.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div>选择字段值</div>
          <Select
            style={{ width: 220 }}
            options={fieldValues}
            placeholder="请选择一个字段值"
            onSelect={setSelectedValue}
            getPopupContainer={(triggerNode) => triggerNode.parentElement!}
          />
        </div>
      )}

      <Button type="primary" onClick={handleCallAPI}>
        调用接口并写入表格
      </Button>
    </div>
  );
}

// ====== 渲染到页面 ======
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LoadApp />
  </React.StrictMode>
);
