"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, X, FileText, Check, Loader2 } from "lucide-react";

interface Question {
  id: string;
  text: string;
  type: string;
  options?: any[] | null;
  requiresEvidence: boolean;
}

interface SurveyQuestionProps {
  question: Question;
  value?: string;
  onAnswer: (questionId: string, value: string) => void;
  onUpload?: (questionId: string, file: File) => void;
  onRemoveFile?: (questionId: string) => void;
  uploadedFile?: string | null;
  isUploading?: boolean;
}

export default function SurveyQuestion({ 
  question, 
  value, 
  onAnswer, 
  onUpload,
  onRemoveFile,
  uploadedFile,
  isUploading = false
}: SurveyQuestionProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const q = question ?? {};

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files?.[0] && onUpload) {
      onUpload(q?.id, files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (files?.[0] && onUpload) {
      onUpload(q?.id, files[0]);
    }
  };

  const renderInput = () => {
    switch (q?.type) {
      case "SCALE":
        return (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm text-gray-500 px-1">
              <span>Düşük Olgunluk</span>
              <span>Yüksek Olgunluk</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => onAnswer?.(q?.id, String(num))}
                  className={`flex-1 py-4 rounded-lg font-semibold text-lg transition-all ${
                    value === String(num)
                      ? "bg-[#1e3a8a] text-white shadow-lg scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        );

      case "YES_NO":
        return (
          <div className="flex gap-4">
            {["yes", "no"].map((option) => (
              <button
                key={option}
                onClick={() => onAnswer?.(q?.id, option)}
                className={`flex-1 py-4 rounded-lg font-medium text-lg capitalize transition-all ${
                  value === option
                    ? "bg-[#1e3a8a] text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {option === "yes" ? <Check className="inline mr-2" size={20} /> : null}
                {option === "yes" ? "Evet" : "Hayır"}
              </button>
            ))}
          </div>
        );

      case "MULTIPLE_CHOICE":
        const options = q?.options as any[] ?? [];
        return (
          <div className="grid gap-3">
            {options?.map((option: any) => (
              <button
                key={option?.value}
                onClick={() => onAnswer?.(q?.id, option?.value)}
                className={`p-4 rounded-lg text-left transition-all ${
                  value === option?.value
                    ? "bg-[#1e3a8a] text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {option?.label ?? option?.value ?? ''}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
    >
      <h3 className="text-lg font-medium text-gray-900 mb-6">{q?.text ?? ''}</h3>
      
      {renderInput()}

      {q?.requiresEvidence && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-600 mb-3 flex items-center gap-2">
            <FileText size={16} className="text-[#a78bfa]" />
            Bu soru için kanıt belgesi gereklidir
          </p>
          
          {isUploading ? (
            <div className="flex items-center justify-center p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
              <Loader2 className="animate-spin text-purple-500 mr-2" size={20} />
              <span className="text-purple-600 text-sm">Dosya yükleniyor...</span>
            </div>
          ) : uploadedFile ? (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <span className="text-green-700 text-sm flex items-center gap-2">
                <Check size={16} /> {uploadedFile}
              </span>
              <button 
                onClick={() => onRemoveFile?.(q?.id)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                title="Dosyayı kaldır"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-[#a78bfa] bg-purple-50"
                  : "border-gray-200 hover:border-[#a78bfa] hover:bg-gray-50"
              }`}
            >
              <Upload className="mx-auto text-gray-400 mb-2" size={24} />
              <p className="text-sm text-gray-500">Dosyayı buraya bırakın veya yüklemek için tıklayın</p>
              <p className="text-xs text-gray-400 mt-1">PDF, 10MB&apos;a kadar görseller</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileChange}
              />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}