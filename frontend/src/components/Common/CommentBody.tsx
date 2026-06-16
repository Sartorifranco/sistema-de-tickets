import React, { useMemo, useState, useCallback } from 'react';
import { sanitizeCommentHtml } from '../../utils/commentHtml';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface CommentBodyProps {
    text: string;
    className?: string;
}

const CommentBody: React.FC<CommentBodyProps> = ({ text, className = '' }) => {
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);

    const safeHtml = useMemo(() => sanitizeCommentHtml(text || ''), [text]);

    const openLightbox = useCallback((src: string) => {
        setLightboxSrc(src);
        setZoom(1);
    }, []);

    const closeLightbox = useCallback(() => {
        setLightboxSrc(null);
        setZoom(1);
    }, []);

    const handleBodyClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
                const src = (target as HTMLImageElement).src;
                if (src) openLightbox(src);
            }
        },
        [openLightbox]
    );

    if (!safeHtml) return null;

    return (
        <>
            <div
                className={`comment-body text-gray-800 mt-2 text-sm leading-relaxed break-words [&_img]:max-w-full [&_img]:max-h-64 [&_img]:rounded-lg [&_img]:border [&_img]:border-gray-200 [&_img]:my-2 [&_img]:cursor-zoom-in [&_img]:hover:opacity-90 [&_img]:transition-opacity [&_u]:underline ${className}`}
                dangerouslySetInnerHTML={{ __html: safeHtml }}
                onClick={handleBodyClick}
                role="presentation"
            />

            {lightboxSrc && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col bg-black/90"
                    onClick={closeLightbox}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Imagen ampliada"
                >
                    <div
                        className="flex items-center justify-between gap-2 px-4 py-3 text-white shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="text-sm text-gray-300">Clic fuera de la imagen para cerrar</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                                title="Alejar"
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                                title="Acercar"
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>
                            <button
                                type="button"
                                onClick={closeLightbox}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                                title="Cerrar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div
                        className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={lightboxSrc}
                            alt="Imagen del comentario ampliada"
                            className="max-w-none transition-transform duration-150 ease-out shadow-2xl rounded-lg"
                            style={{
                                transform: `scale(${zoom})`,
                                maxHeight: zoom <= 1 ? '85vh' : undefined,
                                maxWidth: zoom <= 1 ? '95vw' : undefined,
                            }}
                            draggable={false}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default CommentBody;
