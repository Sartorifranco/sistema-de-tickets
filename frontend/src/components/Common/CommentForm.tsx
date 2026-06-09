import React, { useRef, useState } from 'react';
import { UserRole } from '../../types';
import { clInput } from '../../utils/cleanLightUi';
import { Bold, Italic, Underline, ImagePlus } from 'lucide-react';

interface CommentFormProps {
    onAddComment: (commentText: string, isInternal: boolean, images?: File[]) => Promise<void>;
    userRole: UserRole;
}

function isEditorEmpty(html: string): boolean {
    const stripped = html
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<div><br><\/div>/gi, '')
        .replace(/<p><br><\/p>/gi, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .trim();
    return stripped.length === 0;
}

const CommentForm: React.FC<CommentFormProps> = ({ onAddComment, userRole }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isInternal, setIsInternal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingImages, setPendingImages] = useState<File[]>([]);

    const execFormat = (command: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false);
    };

    const handleInsertLineBreak = () => {
        editorRef.current?.focus();
        document.execCommand('insertLineBreak', false);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return;
        setPendingImages((prev) => [...prev, ...files].slice(0, 5));
        e.target.value = '';
    };

    const removePendingImage = (index: number) => {
        setPendingImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const html = editorRef.current?.innerHTML || '';
        if (isEditorEmpty(html) && pendingImages.length === 0) return;

        setIsSubmitting(true);
        try {
            const finalIsInternal = userRole === 'client' ? false : isInternal;
            await onAddComment(html, finalIsInternal, pendingImages);
            if (editorRef.current) editorRef.current.innerHTML = '';
            setPendingImages([]);
            setIsInternal(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="mb-2 flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-gray-200 bg-gray-50 px-2 py-1.5">
                <button
                    type="button"
                    title="Negrita"
                    onClick={() => execFormat('bold')}
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-700"
                    disabled={isSubmitting}
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    title="Cursiva"
                    onClick={() => execFormat('italic')}
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-700"
                    disabled={isSubmitting}
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    title="Subrayado"
                    onClick={() => execFormat('underline')}
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-700"
                    disabled={isSubmitting}
                >
                    <Underline className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    title="Salto de línea"
                    onClick={handleInsertLineBreak}
                    className="px-2 py-1 text-xs font-semibold rounded-lg hover:bg-gray-200 text-gray-700"
                    disabled={isSubmitting}
                >
                    ↵ Enter
                </button>
                <button
                    type="button"
                    title="Adjuntar imagen"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-700"
                    disabled={isSubmitting || pendingImages.length >= 5}
                >
                    <ImagePlus className="w-4 h-4" />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                />
                <span className="text-xs text-gray-500 ml-auto hidden sm:inline">
                    Negrita, cursiva, subrayado y hasta 5 imágenes
                </span>
            </div>

            <div
                ref={editorRef}
                contentEditable={!isSubmitting}
                role="textbox"
                aria-multiline="true"
                data-placeholder="Escribí tu respuesta..."
                className={`${clInput} min-h-[7rem] max-h-64 overflow-y-auto rounded-t-none border-t-0 focus:ring-red-500 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400`}
                suppressContentEditableWarning
            />

            {pendingImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {pendingImages.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="relative">
                            <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="h-16 w-16 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                                type="button"
                                onClick={() => removePendingImage(index)}
                                className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 leading-5"
                                aria-label="Quitar imagen"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between sm:items-center mt-4 gap-4">
                {userRole === 'agent' || userRole === 'admin' ? (
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="isInternal"
                            checked={isInternal}
                            onChange={(e) => setIsInternal(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            disabled={isSubmitting}
                        />
                        <label htmlFor="isInternal" className="ml-2 block text-sm text-gray-900">
                            Marcar como Nota Interna
                        </label>
                    </div>
                ) : (
                    <div />
                )}
                <button
                    type="submit"
                    className="bg-red-600 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-red-700 w-full sm:w-auto disabled:bg-gray-400 shadow-sm"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                </button>
            </div>
        </form>
    );
};

export default CommentForm;
