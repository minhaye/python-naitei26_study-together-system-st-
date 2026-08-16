import React, { useState, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Modal } from './Modal';
import { Button } from './Button';
import { Delete, Check } from 'lucide-react';

interface MathFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formulaLaTeX: string, isInline: boolean) => void;
}

type MathTab = 'basic' | 'trig' | 'calculus' | 'symbols' | 'system' | 'greek';

const TAB_LABELS: Record<MathTab, string> = {
  basic: 'h/a (Phân số & Căn)',
  trig: 'sin (Lượng giác)',
  calculus: 'f (Tích phân & Đạo hàm)',
  symbols: '∞ ≠ € (Ký tự)',
  system: 'HPT (Hệ phương trình)',
  greek: 'αβγ (Ký tự Hy Lạp)',
};

interface VirtualKey {
  label: string;
  latex: string;
}

const VIRTUAL_KEYS: Record<MathTab, VirtualKey[]> = {
  basic: [
    { label: 'a/b', latex: '\\frac{a}{b}' },
    { label: '√x', latex: '\\sqrt{x}' },
    { label: 'ⁿ√x', latex: '\\sqrt[n]{x}' },
    { label: 'x²', latex: 'x^2' },
    { label: 'xⁿ', latex: 'x^{n}' },
    { label: 'x₁', latex: 'x_{1}' },
    { label: '|x|', latex: '|x|' },
    { label: '(a)', latex: '(a)' },
  ],
  trig: [
    { label: 'sin', latex: '\\sin(x)' },
    { label: 'cos', latex: '\\cos(x)' },
    { label: 'tan', latex: '\\tan(x)' },
    { label: 'cot', latex: '\\cot(x)' },
    { label: 'π', latex: '\\pi ' },
    { label: 'θ', latex: '\\theta ' },
    { label: 'α', latex: '\\alpha ' },
    { label: 'rad', latex: '^{\\circ}' },
  ],
  calculus: [
    { label: '∫', latex: '\\int f(x)dx' },
    { label: '∫ₐᵇ', latex: '\\int_{a}^{b} f(x)dx' },
    { label: 'f\'(x)', latex: 'f\'(x)' },
    { label: 'lim', latex: '\\lim_{x \\to x_0} f(x)' },
    { label: '∑', latex: '\\sum_{i=1}^{n} a_i' },
    { label: '∆', latex: '\\Delta ' },
    { label: 'dy/dx', latex: '\\frac{dy}{dx}' },
  ],
  symbols: [
    { label: '∞', latex: '\\infty ' },
    { label: '≠', latex: '\\neq ' },
    { label: '≤', latex: '\\le ' },
    { label: '≥', latex: '\\ge ' },
    { label: '±', latex: '\\pm ' },
    { label: '≈', latex: '\\approx ' },
    { label: '∈', latex: '\\in ' },
    { label: '⊂', latex: '\\subset ' },
    { label: '∀', latex: '\\forall ' },
    { label: '∃', latex: '\\exists ' },
  ],
  system: [
    { label: 'Hệ 2 PT', latex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}' },
    { label: 'Hệ 3 PT', latex: '\\begin{cases} x + y + z = 1 \\\\ x - y = 0 \\\\ y + z = 2 \\end{cases}' },
    { label: '[A|B]', latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}' },
  ],
  greek: [
    { label: 'α', latex: '\\alpha ' },
    { label: 'β', latex: '\\beta ' },
    { label: 'γ', latex: '\\gamma ' },
    { label: 'δ', latex: '\\delta ' },
    { label: 'λ', latex: '\\lambda ' },
    { label: 'ω', latex: '\\omega ' },
    { label: 'Ω', latex: '\\Omega ' },
    { label: 'μ', latex: '\\mu ' },
  ],
};

/**
 * MathFormulaModal — Modal soạn thảo công thức Toán học kèm Bàn phím ảo trực quan.
 */
export const MathFormulaModal: React.FC<MathFormulaModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formula, setFormula] = useState('');
  const [isInline, setIsInline] = useState(true);
  const [activeTab, setActiveTab] = useState<MathTab>('basic');

  // Reset về chuỗi rỗng mỗi khi mở Modal
  useEffect(() => {
    if (isOpen) {
      setFormula('');
      setIsInline(true);
      setActiveTab('basic');
    }
  }, [isOpen]);

  const handleInsertKey = (key: VirtualKey) => {
    setFormula((prev) => prev + key.latex);
  };

  const handleClear = () => {
    setFormula('');
  };

  const handleConfirm = () => {
    if (!formula.trim()) return;
    onSubmit(formula.trim(), isInline);
    onClose();
  };

  // Render Live Preview bằng KaTeX
  let previewHtml = '';
  if (formula.trim()) {
    try {
      previewHtml = katex.renderToString(formula, {
        displayMode: !isInline,
        throwOnError: false,
      });
    } catch (err) {
      previewHtml = `<span style="color:red">Cú pháp chưa hợp lệ</span>`;
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm công thức Toán học">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: '#FFFFFF', color: '#0F172A' }}>
        {/* Checkbox Hiển thị cùng dòng */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: '600',
            color: '#334155',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={isInline}
            onChange={(e) => setIsInline(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              cursor: 'pointer',
              accentColor: '#1D4ED8',
            }}
          />
          <span>Hiển thị cùng dòng (Inline Math)</span>
        </label>

        {/* Ô Soạn thảo Formula Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>
              Mã công thức LaTeX (gõ hoặc chọn từ phím ảo bên dưới):
            </label>
            {formula && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: '600',
                }}
              >
                <Delete size={14} /> Xóa mã
              </button>
            )}
          </div>
          <input
            type="text"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="Ví dụ: \frac{a}{b} hoặc \sqrt{x}"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 14,
              fontFamily: 'monospace',
              color: '#0F172A',
              outline: 'none',
              background: '#F8FAFC',
            }}
          />
        </div>

        {/* Khung Live Preview bằng KaTeX */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>
            Xem trước công thức thực tế:
          </label>
          <div
            style={{
              minHeight: 56,
              padding: 14,
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: isInline ? 'flex-start' : 'center',
              overflowX: 'auto',
              color: '#0F172A',
            }}
          >
            {formula.trim() ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <span style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>
                Bấm chọn các phím ảo bên dưới hoặc gõ để xem trước công thức...
              </span>
            )}
          </div>
        </div>

        {/* Bàn Phím Ảo (Virtual Keyboard Tabs - Nền sáng rõ ràng) */}
        <div style={{ border: '1px solid #CBD5E1', borderRadius: 10, overflow: 'hidden', background: '#F8FAFC' }}>
          {/* Tabs Header */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #CBD5E1', background: '#F1F5F9' }}>
            {(Object.keys(TAB_LABELS) as MathTab[]).map((tabKey) => {
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveTab(tabKey)}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    background: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? '#1D4ED8' : '#475569',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    borderBottom: isActive ? '2px solid #1D4ED8' : 'none',
                  }}
                >
                  {TAB_LABELS[tabKey]}
                </button>
              );
            })}
          </div>

          {/* Phím bấm ảo */}
          <div
            style={{
              padding: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: 8,
              maxHeight: 140,
              overflowY: 'auto',
              background: '#F8FAFC',
            }}
          >
            {VIRTUAL_KEYS[activeTab].map((keyItem, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleInsertKey(keyItem)}
                style={{
                  padding: '8px 4px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#0F172A',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#EFF6FF';
                  e.currentTarget.style.borderColor = '#93C5FD';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#FFFFFF';
                  e.currentTarget.style.borderColor = '#CBD5E1';
                }}
              >
                {keyItem.label}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button variant="outline" type="button" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" type="button" onClick={handleConfirm} disabled={!formula.trim()}>
            <Check size={16} /> Xác nhận chèn
          </Button>
        </div>
      </div>
    </Modal>
  );
};
