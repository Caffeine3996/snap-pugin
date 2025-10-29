import React, { useState, useEffect } from "react";
import { Drawer, Form, Select, Button, message, Radio } from "antd";

interface Props {
  visible: boolean;
  recordList: { id: string; name: string }[];
  fieldMetaList: { id: string; name: string }[];
  tempRecordId?: string;
  tempTargetFieldId?: string;
  tempOperationMode?: "add" | "overwrite" | "fillEmpty"; // ✅ 新增
  onClose: () => void;
  onConfirm: (recordId: string, fieldId: string, mode: "add" | "overwrite" | "fillEmpty") => void; // ✅ 新增参数
}

export default function SettingsDrawer({
  visible,
  recordList,
  fieldMetaList,
  tempRecordId,
  tempTargetFieldId,
  tempOperationMode = "add", // 默认值
  onClose,
  onConfirm,
}: Props) {
  // ✅ 内部状态，控制临时选择值
  const [recordId, setRecordId] = useState<string | undefined>(tempRecordId);
  const [targetFieldId, setTargetFieldId] = useState<string | undefined>(tempTargetFieldId);
  const [operationMode, setOperationMode] = useState<"add" | "overwrite" | "fillEmpty">(tempOperationMode);

  // 当外部重新打开时同步初始值
  useEffect(() => {
    if (visible) {
      setRecordId(tempRecordId);
      setTargetFieldId(tempTargetFieldId);
      setOperationMode(tempOperationMode);
    }
  }, [visible, tempRecordId, tempTargetFieldId, tempOperationMode]);

  // ✅ 点击确定时才触发 onConfirm
  const handleConfirm = () => {
    if (!recordId || !targetFieldId) return message.error("请选择源记录和写入列");
    onConfirm(recordId, targetFieldId, operationMode);
  };

  return (
    <Drawer
      title="设置"
      placement="right"
      width={380}
      onClose={onClose}
      open={visible}
      footer={
        <div style={{ textAlign: "right" }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" onClick={handleConfirm}>
            确定
          </Button>
        </div>
      }
    >
      <Form layout="horizontal" colon={false}>
        {/* ✅ 新增：操作模式选择 */}
        <Form.Item label="操作模式">
          <Radio.Group
            value={operationMode}
            onChange={(e) => setOperationMode(e.target.value)}
          >
            <Radio value="add">新增</Radio>
            <Radio value="overwrite">聚焦覆盖</Radio>
            <Radio value="fillEmpty">空白补全</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="源记录">
          <Select
            showSearch
            placeholder="请选择源记录"
            value={recordId}
            options={recordList.map((r) => ({ label: r.name, value: r.id }))}
            onChange={setRecordId}
          />
        </Form.Item>

        <Form.Item label="写入列">
          <Select
            showSearch
            placeholder="请选择写入列"
            value={targetFieldId}
            options={fieldMetaList.map((f) => ({ label: f.name, value: f.id }))}
            onChange={setTargetFieldId}
          />
        </Form.Item>


      </Form>
    </Drawer>
  );
}
