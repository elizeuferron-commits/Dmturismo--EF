import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './UI';
import { toast } from 'sonner';

interface SignaturePadProps {
  onSignatureConfirmed: (signatureData: string) => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureConfirmed }) => {
  const sigPad = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigPad.current?.clear();
  };

  const confirm = () => {
    if (sigPad.current?.isEmpty()) {
      toast.error('Por favor, assine antes de confirmar.');
      return;
    }
    onSignatureConfirmed(sigPad.current!.toDataURL());
    toast.success('Assinatura salva!');
  };

  return (
    <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 mt-6">
      <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Assinatura Digital (Motorista)</h4>
      <div className="border-2 border-dashed border-zinc-200 rounded-2xl bg-white mb-4">
        <SignatureCanvas
          ref={sigPad}
          penColor='black'
          canvasProps={{width: 500, height: 150, className: 'sigCanvas'}}
        />
      </div>
      <div className="flex gap-4">
        <Button variant="secondary" onClick={clear} className="flex-1">Limpar</Button>
        <Button onClick={confirm} className="flex-1">Confirmar Assinatura</Button>
      </div>
    </div>
  );
};
