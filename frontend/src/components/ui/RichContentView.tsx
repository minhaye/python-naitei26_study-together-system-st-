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
 * RichContentView — Component hiển thị nội dung giàu định dạng.
 * Render an toàn: HTML, Ảnh đính kèm, Công thức toán KaTeX, và Hashtag pills.
 */
export const RichContentView: React.FC<RichContentViewProps> = ({
  content,
  style,
  className = '',
  onTagClick,
}) => {
  if (!content) return null;

  // Xử lý render KaTeX cho nội dung
  const htmlWithMath = renderMathInHtml(content);

  // Phân rã Hashtags
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
  );
};
