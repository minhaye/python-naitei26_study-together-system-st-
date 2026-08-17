import React, { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Underline } from '@tiptap/extension-underline';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { MathFormulaModal } from './MathFormulaModal';

import {
  Plus,
  Minus,
  Image as ImageIcon,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Subscript as SubIcon,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export interface EditTextToolProps {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  minHeight?: number;
}

/**
 * ToolbarButton — Component nút bấm trên thanh công cụ EditTextTool kèm hiệu ứng Hover xám nhạt mượt mà.
 */
const ToolbarButton: React.FC<{
  onClick?: () => void;
  title: string;
  isActive?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, isActive = false, children }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: isActive ? '#CBD5E1' : isHovered ? '#E2E8F0' : 'transparent',
        border: 'none',
        borderRadius: 6,
        padding: '6px 10px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isActive ? '#1D4ED8' : isHovered ? '#0F172A' : '#475569',
        fontSize: 13,
        fontWeight: '600',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      {children}
    </button>
  );
};

/**
 * EditTextTool — Trình soạn thảo văn bản tối ưu dựa trên TipTap.
 *
 * Tích hợp:
 *   - +/– : Mở Modal soạn thảo công thức Toán học kèm Bàn phím ảo trực quan (KaTeX render)
 *   - 🖼️  : Tải ảnh trực tiếp từ máy tính/điện thoại (File Picker)
 *   - B I U Tₓ: In đậm, In nghiêng, Gạch chân, Chỉ số dưới/trên
 *   - ⛶  : Phóng to / Thu nhỏ toàn màn hình
 *   - Nút công cụ có hiệu ứng Hover xám nhạt kiểu Facebook
 */
export const EditTextTool: React.FC<EditTextToolProps> = ({
  content = '',
  onChange,
  placeholder = 'Nhập nội dung câu hỏi hoặc câu trả lời...',
  style,
  minHeight = 120,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Subscript,
      Superscript,
      Image.configure({
        inline: true,
        HTMLAttributes: {
          style: 'max-height: 360px; border-radius: 12px; object-fit: cover; margin: 8px 0; border: 1px solid #E2E8F0;',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  // Tải ảnh trực tiếp từ máy tính qua File Picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        if (src) {
          editor.chain().focus().setImage({ src }).run();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Chèn công thức toán học từ MathFormulaModal
  const handleInsertMath = (latex: string, isInline: boolean) => {
    if (isInline) {
      editor.chain().focus().insertContent(` <code>$${latex}$</code> `).run();
    } else {
      editor.chain().focus().insertContent(`<p style="text-align: center; margin: 12px 0;"><code>$$${latex}$$</code></p>`).run();
    }
  };

  return (
    <div
      style={{
        border: '1px solid #CBD5E1',
        borderRadius: 12,
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : undefined,
        zIndex: isFullscreen ? 9999 : 1,
        boxShadow: isFullscreen ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
        ...style,
      }}
    >
      {/* Input File Ẩn cho Tải ảnh từ máy */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* TipTap Editor Content */}
      <div
        style={{
          padding: 16,
          minHeight: isFullscreen ? 'calc(100vh - 60px)' : minHeight,
          overflowY: 'auto',
          fontSize: 15,
          lineHeight: 1.6,
          color: '#0F172A',
          outline: 'none',
          cursor: 'text',
        }}
      >
        <EditorContent editor={editor} placeholder={placeholder} style={{ outline: 'none' }} />
      </div>

      {/* Toolbar Bottom Container (Khung công cụ tối ưu kèm Hover xám nhạt) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 14px',
          background: '#F1F5F9',
          borderTop: '1px solid #E2E8F0',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Nhóm nút công cụ bên trái */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {/* +/– Chèn công thức toán (Mở Modal Bàn phím ảo) */}
          <ToolbarButton
            onClick={() => setIsMathModalOpen(true)}
            title="Mở Bàn phím ảo Soạn công thức Toán (+/-)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Plus size={13} />
              <Minus size={13} />
            </div>
          </ToolbarButton>

          {/* 🖼️ Tải ảnh từ máy tính/điện thoại */}
          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            title="Tải ảnh lên từ thiết bị"
          >
            <ImageIcon size={15} />
          </ToolbarButton>

          <div style={{ width: 1, height: 16, background: '#CBD5E1', margin: '0 4px' }} />

          {/* B - Bold */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="In đậm (Bold)"
            isActive={editor.isActive('bold')}
          >
            <BoldIcon size={15} />
          </ToolbarButton>

          {/* I - Italic */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="In nghiêng (Italic)"
            isActive={editor.isActive('italic')}
          >
            <ItalicIcon size={15} />
          </ToolbarButton>

          {/* U - Underline */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Gạch chân (Underline)"
            isActive={editor.isActive('underline')}
          >
            <UnderlineIcon size={15} />
          </ToolbarButton>

          {/* Tₓ - Subscript / Superscript */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            title="Chỉ số dưới (Subscript)"
            isActive={editor.isActive('subscript')}
          >
            <SubIcon size={15} />
          </ToolbarButton>
        </div>

        {/* Nút Phóng to / Thu nhỏ toàn màn hình bên phải */}
        <ToolbarButton
          onClick={() => setIsFullscreen((prev) => !prev)}
          title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          isActive={isFullscreen}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </ToolbarButton>
      </div>

      {/* Modal Bàn phím ảo Soạn thảo Toán học */}
      <MathFormulaModal
        isOpen={isMathModalOpen}
        onClose={() => setIsMathModalOpen(false)}
        onSubmit={handleInsertMath}
      />
    </div>
  );
};
