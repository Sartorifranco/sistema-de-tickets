import React, { useMemo } from 'react';
import { sanitizeCommentHtml } from '../../utils/commentHtml';

interface CommentBodyProps {
    text: string;
    className?: string;
}

const CommentBody: React.FC<CommentBodyProps> = ({ text, className = '' }) => {
    const safeHtml = useMemo(() => sanitizeCommentHtml(text || ''), [text]);

    if (!safeHtml) return null;

    return (
        <div
            className={`comment-body text-gray-800 mt-2 text-sm leading-relaxed break-words [&_img]:max-w-full [&_img]:max-h-64 [&_img]:rounded-lg [&_img]:border [&_img]:border-gray-200 [&_img]:my-2 [&_u]:underline ${className}`}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
    );
};

export default CommentBody;
