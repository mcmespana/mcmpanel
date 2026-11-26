import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lo que se imprime («Guardar como PDF») va en un portal colgado de <body>,
 * fuera de #root: así el CSS de impresión puede esconder todo el panel (o la
 * página) y dejar solo el informe, sin heredar el fondo oscuro ni el layout.
 * En pantalla está oculto (`#report-print-portal { display: none }`).
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let el = document.getElementById('report-print-portal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'report-print-portal';
      document.body.appendChild(el);
    }
    setHost(el);
  }, []);
  return host ? createPortal(children, host) : null;
}

/** Contenedor fuera de pantalla para pintar lo que se va a capturar como imagen. */
export function Offscreen({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
      {children}
    </div>
  );
}
