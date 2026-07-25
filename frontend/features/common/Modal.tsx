import { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span>FLUMENX / CREATE</span><h2>{title}</h2></div><button onClick={onClose}><X/></button></div>{children}</div></div>;
}
