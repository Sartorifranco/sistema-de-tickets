import React, { useState } from 'react';

interface HelpBoxProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
}

const HelpBox: React.FC<HelpBoxProps> = ({ title, children, defaultExpanded = false }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-blue-900 hover:bg-blue-100 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <span className="text-blue-600" aria-hidden>ℹ️</span>
                    {title}
                </span>
                <span className="text-blue-600 text-xs">{expanded ? '▲' : '▼'}</span>
            </button>
            {expanded && (
                <div className="px-4 pb-3 text-sm text-blue-800 space-y-2">
                    {children}
                </div>
            )}
        </div>
    );
};

export default HelpBox;
