import React, { useState, useEffect } from "react";
import { Drawer, Form, Select, Button, message } from "antd";

interface Props {
  visible: boolean;
  recordList: { id: string; name: string }[];
  fieldMetaList: { id: string; name: string }[];
  tempRecordId?: string;
  tempTargetFieldId?: string;
  onClose: () => void;
  onConfirm: (recordId: string, fieldId: string) => void;
}

export default function SettingsDrawer({
  visible,
  recordList,
  fieldMetaList,
  tempRecordId,
  tempTargetFieldId,
  onClose,
  onConfirm,
}: Props) {
  // ✅ 内部状态，控制临时选择值
  const [recordId, setRecordId] = useState<string | undefined>(tempRecordId);
  const [targetFieldId, setTargetFieldId] = useState<string | undefined>(tempTargetFieldId);

  // 当外部重新打开时同步初始值
  useEffect(() => {
    if (visible) {
      setRecordId(tempRecordId);
      setTargetFieldId(tempTargetFieldId);
    }
  }, [visible, tempRecordId, tempTargetFieldId]);

  // ✅ 点击确定时才触发 onConfirm
  const handleConfirm = () => {
    if (!recordId || !targetFieldId)  return message.error("请选择源记录和写入列");
    onConfirm(recordId, targetFieldId);
  };

  return (
    <Drawer
      title="配置"
      placement="right"
      width={360}
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
        <Form.Item label="源记录">
          <Select
            showSearch
            placeholder="请选择源记录"
            value={recordId}
            options={recordList.map((r) => ({ label: r.name, value: r.id }))}
            onChange={setRecordId} // ✅ 只更新状态，不触发提交
          />
        </Form.Item>

        <Form.Item label="写入列">
          <Select
            showSearch
            placeholder="请选择写入列"
            value={targetFieldId}
            options={fieldMetaList.map((f) => ({ label: f.name, value: f.id }))}
            onChange={setTargetFieldId} // ✅ 只更新状态，不触发提交
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
