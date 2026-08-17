import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Hashtag } from './Hashtag';
import { parseContentWithHashtags } from '../../pages/forum/lib/hashtagUtils';

export interface RichContentViewProps {
  content: string;
  style?: React.CSSProperties;
  className?: string;
  onTagClick?: (tag: string) => void;
}

/**
 * Bóc tách tất cả các đường dẫn ảnh (src) từ các thẻ <img> trong HTML.
 * Trả về { textHtml: HTML đã bỏ thẻ img, images: mảng các src ảnh }
 */
export function extractImagesFromHtml(rawHtml: string): { textHtml: string; images: string[] } {
  if (!rawHtml) return { textHtml: '', images: [] };

  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = imgRegex.exec(rawHtml)) !== null) {
    if (match[1]) {
      images.push(match[1]);
    }
  }

  // Loại bỏ các thẻ <img> khỏi HTML văn bản
  let textHtml = rawHtml.replace(/<img[^>]*>/gi, '');
  // Xóa các paragraph rỗng thừa
  textHtml = textHtml.replace(/<p>\s*<\/p>/gi, '');

  return { textHtml, images };
}

/**
 * Thô hóa công thức Toán trong HTML thô:
 * Tự động tìm `<code>$formula$</code>` hoặc `$formula$` và render sang KaTeX HTML.
 */
function renderMathInHtml(rawContent: string): string {
  if (!rawContent) return '';

  // 1. Thay thế block math `$$formula$$` hoặc `<code>$$formula$$</code>`
  let processed = rawContent.replace(/(?:<code>)?\$\$(.*?)\$\$(?:<\/code>)?/g, (_, latex) => {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false });
    } catch {
      return `$$${latex}$$`;
    }
  });

  // 2. Thay thế inline math `$formula$` hoặc `<code>$formula$</code>`
  processed = processed.replace(/(?:<code>)?\$(.*?)\$(?:<\/code>)?/g, (_, latex) => {
    try {
      return katex.renderToString(latex, { displayMode: false, throwOnError: false });
    } catch {
      return `$${latex}$`;
    }
  });

  return processed;
}

/**
 * RichContentView — Component hiển thị nội dung giàu định dạng chuẩn kiểu Facebook.
 * Render an toàn: HTML, Khung ảnh đính kèm riêng biệt (Facebook-style attachment), Công thức toán KaTeX, và Hashtag pills.
 */
export const RichContentView: React.FC<RichContentViewProps> = ({
  content,
  style,
  className = '',
  onTagClick,
}) => {
  if (!content) return null;

  // 1. Tách mảng ảnh đính kèm ra khỏi nội dung văn bản
  const { textHtml, images } = extractImagesFromHtml(content);

  // 2. Xử lý render KaTeX cho nội dung văn bản
  const htmlWithMath = renderMathInHtml(textHtml);

  // 3. Phân rã Hashtags
  const parts = parseContentWithHashtags(htmlWithMath);

  return (
    <div
      className={`rich-content-view ${className}`}
      style={{
        fontSize: 15,
        color: '#334155',
        lineHeight: 1.6,
        wordBreak: 'break-word',
        ...style,
      }}
    >
      {/* Văn bản (HTML + KaTeX + Hashtag) */}
      {parts.length > 0 && (
        <div>
          {parts.map((part, idx) => {
            if (part.type === 'hashtag') {
              return (
                <Hashtag
                  key={idx}
                  tag={part.value}
                  onClick={onTagClick || ((t) => alert(`Lọc bài viết theo thẻ ${t}`))}
                  style={{ margin: '0 2px' }}
                />
              );
            }

            return (
              <span
                key={idx}
                dangerouslySetInnerHTML={{ __html: part.value }}
              />
            );
          })}
        </div>
      )}

      {/* Khung ảnh đính kèm riêng biệt kiểu Facebook (Facebook Attachment Frame) */}
      {images.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {images.map((src, imgIdx) => (
            <div
              key={imgIdx}
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #E2E8F0',
                background: '#F1F5F9',
                maxHeight: 480,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <img
                src={src}
                alt={`Ảnh đính kèm ${imgIdx + 1}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: 480,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
