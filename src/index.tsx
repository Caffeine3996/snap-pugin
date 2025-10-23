import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  bitable,
  CurrencyCode,
  FieldType,
  ICurrencyField,
  ITextField,
} from "@lark-base-open/js-sdk";
import { Alert, AlertProps, Button, Select, Input, Switch, Modal } from "antd";
import { CURRENCY } from "./const";
import { getExchangeRate } from "./exchange-api";

function LoadApp() {
  const [info, setInfo] = useState("正在获取表格信息，请稍候...");
  const [alertType, setAlertType] = useState<AlertProps["type"]>("info");

  const [fieldMetaList, setFieldMetaList] = useState<any[]>([]);
  const [fieldType, setFieldType] = useState<FieldType | "">("");
  const [selectFieldId, setSelectFieldId] = useState<string>();
  const [currency, setCurrency] = useState<CurrencyCode>();
  const [textValue, setTextValue] = useState<string>("");

  const [recordId, setRecordId] = useState<string>(); // 当前选中记录ID
  const [recordList, setRecordList] = useState<{ id: string; name: string }[]>(
    []
  );
  const [useFocus, setUseFocus] = useState<boolean>(false); // 是否使用聚焦模式

  useEffect(() => {
    const fn = async () => {
      try {
        const table = await bitable.base.getActiveTable();
        const tableName = await table.getName();

        console.log("当前表格 ID:", table.id);

        setInfo(`表格名称：${tableName}`);
        setAlertType("success");

        // 获取字段列表
        const fields = await table.getFieldMetaList();
        setFieldMetaList(fields);

        // 获取记录列表
        const ids = await table.getRecordIdList();
        const recList = ids.map((id) => ({ id, name: `记录 ${id}` }));
        setRecordList(recList);
      } catch (err) {
        setInfo("获取表格信息失败，请检查表格或权限");
        setAlertType("error");
        console.error(err);
      }
    };
    fn();
  }, []);

  const formatFieldList = () => {
    if (!fieldType) return [];
    const filtered = fieldMetaList.filter((f) => f.type === fieldType);
    return filtered.map((f) => ({ label: f.name, value: f.id }));
  };

  const transform = async () => {
    const table = await bitable.base.getActiveTable();
    let targetFieldId = selectFieldId;
    let targetRecordId = recordId;

    // 如果启用了聚焦模式，则覆盖 fieldId 和 recordId
    if (useFocus) {
      const selection = await bitable.base.getSelection();
      if (!selection) {
        setInfo("请先在表格中选中一个单元格");
        setAlertType("warning");
        return;
      }
      targetFieldId = selection.fieldId ?? undefined;
      targetRecordId = selection.recordId ?? undefined;
    }

    if (!targetFieldId) return;

    if (fieldType === FieldType.Currency) {
      if (!currency || !targetRecordId) return;
      const currencyField = await table.getField<ICurrencyField>(targetFieldId);
      const currentCurrency = await currencyField.getCurrencyCode();
      await currencyField.setCurrencyCode(currency);

      const ratio = await getExchangeRate(currentCurrency, currency);
      if (!ratio) return;

      const currentVal = await currencyField.getValue(targetRecordId);
      await currencyField.setValue(targetRecordId, (currentVal || 0) * ratio);
    }

    if (fieldType === FieldType.Text) {
      const textField = await table.getField<ITextField>(targetFieldId);

      if (targetRecordId) {
        // 修改单条记录
        await textField.setValue(targetRecordId, textValue);
        setInfo("修改完成！");
        setAlertType("success");
      } else {
        // 没有选中记录 → 修改所有记录，加确认弹窗
        Modal.confirm({
          title: "确认操作",
          content: "你没有选择记录，将会修改所有记录，是否继续？",
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const allRecordIds = await table.getRecordIdList();
            for (const id of allRecordIds) {
              await textField.setValue(id, textValue);
            }
            setInfo("已修改所有记录！");
            setAlertType("success");
          },
        });
        return;
      }
    }

    if (useFocus) {
      setInfo("已修改聚焦单元格！");
    } else {
      setInfo("修改完成！");
    }
    setAlertType("success");
  };

  return (
    <div style={{ padding: 20 }}>
      <Alert message={info} type={alertType} style={{ marginBottom: 20 }} />

      <div style={{ marginBottom: 10 }}>
        <div>选择字段类型</div>
        <Select
          style={{ width: 200 }}
          onSelect={(val: FieldType) => {
            setFieldType(val);
            setSelectFieldId(undefined);
          }}
          options={[
            { label: "货币字段", value: FieldType.Currency },
            { label: "单行文本字段", value: FieldType.Text },
          ]}
        />
      </div>

      {!useFocus && fieldType && (
        <div style={{ marginBottom: 10 }}>
          <div>选择字段</div>
          <Select
            style={{ width: 200 }}
            onSelect={setSelectFieldId}
            options={formatFieldList()}
          />
        </div>
      )}

      {fieldType === FieldType.Currency && (
        <div style={{ marginBottom: 10 }}>
          <div>选择货币</div>
          <Select
            options={CURRENCY}
            style={{ width: 200 }}
            onSelect={setCurrency}
          />
        </div>
      )}

      {fieldType === FieldType.Text && (
        <div style={{ marginBottom: 10 }}>
          <div>输入文本</div>
          <Input
            style={{ width: 200 }}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
          />
        </div>
      )}

      {!useFocus && (
        <div style={{ marginBottom: 10 }}>
          <div>选择记录</div>
          <Select
            style={{ width: 200 }}
            onSelect={setRecordId}
            options={recordList.map((r) => ({ label: r.name, value: r.id }))}
            allowClear
            placeholder="不选表示全部"
          />
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <span style={{ marginRight: 10 }}>使用聚焦单元格</span>
        <Switch checked={useFocus} onChange={setUseFocus} />
      </div>

      <Button type="primary" onClick={transform}>
        修改
      </Button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LoadApp />
  </React.StrictMode>
);
