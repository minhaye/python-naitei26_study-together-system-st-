/**
 * hashtagUtils.ts — Tiện ích phát hiện, bóc tách và render Hashtag (#tag) cho Diễn đàn.
 */

/**
 * Regex phát hiện tất cả các từ đứng sau dấu `#` (hỗ trợ tiếng Việt Unicode)
 * Ví dụ: "Học #Toán12 thấy phần #GiảiTích rất hay" → ["#Toán12", "#GiảiTích"]
 */
const HASHTAG_REGEX = /#([\w\u00C0-\u024F]+)/g;

/**
 * Bóc tách mảng danh sách Hashtags duy nhất có trong văn bản
 */
export function extractHashtags(content: string): string[] {
  if (!content) return [];
  const matches = content.match(HASHTAG_REGEX);
  if (!matches) return [];
  // Loại bỏ các thẻ trùng lặp
  return Array.from(new Set(matches));
}

/**
 * Phân rã nội dung bài viết thành các đoạn văn bản thô & thẻ Hashtag
 */
export interface ContentPart {
  type: 'text' | 'hashtag';
  value: string;
}

export function parseContentWithHashtags(content: string): ContentPart[] {
  if (!content) return [];
  const parts: ContentPart[] = [];
  let lastIndex = 0;

  content.replace(HASHTAG_REGEX, (match, _, offset) => {
    // Đoạn text trước hashtag
    if (offset > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, offset) });
    }
    // Đoạn hashtag
    parts.push({ type: 'hashtag', value: match });
    lastIndex = offset + match.length;
    return match;
  });

  // Đoạn text còn lại sau hashtag cuối
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return parts;
}
