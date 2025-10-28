import React from "react";
import { Modal, Tooltip, message } from "antd";

export default function PreviewModal({ visible, content, onClose }: any) {
  if (!content) return null;
  return (
    <Modal
      open={visible}
      footer={null}
      onCancel={onClose}
      title={
        <Tooltip title={content.name}>
          <div style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
            {content.name}
          </div>
        </Tooltip>
      }
      width={360}
    >
      <div style={{ paddingTop: 30 }}>
        {content.type === "video" ? (
          <video
            src={content.url}
            controls
            width="100%"
            height="450px"
            onError={() => message.error("视频无法播放")}
          />
        ) : (
          <img src={content.url} alt="preview" style={{ width: "100%", height: 400, objectFit: "contain" }} />
        )}
      </div>
    </Modal>
  );
}
