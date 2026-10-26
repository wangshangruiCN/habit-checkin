import { ModalShell } from "./ModalShell";

interface ConfirmDialogProps {
  habitName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  habitName,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = "delete-dialog-title";

  return (
    <ModalShell titleId={titleId} onClose={onClose} compact>
      <div className="modal-heading">
        <p className="eyebrow">要放下这个习惯吗？</p>
        <h2 id={titleId}>删除“{habitName}”</h2>
        <p>它会从每日清单中移除，过去的打卡记录仍会保留。</p>
      </div>
      <div className="modal-actions">
        <button className="button button--ghost" type="button" onClick={onClose}>
          再想想
        </button>
        <button className="button button--danger" type="button" onClick={onConfirm}>
          确认删除
        </button>
      </div>
    </ModalShell>
  );
}
