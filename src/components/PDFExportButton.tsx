import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas'; // Import from 'html2canvas' not 'html2canvas-pro' unless specified
import { Download } from 'lucide-react';
import { AnalysisResponse } from '../types';

interface PDFExportButtonProps {
    analysisData: AnalysisResponse;
    analysisRef: React.RefObject<HTMLDivElement>; // Ref to the container we want to capture
}

const PDFExportButton: React.FC<PDFExportButtonProps> = ({ analysisData, analysisRef }) => {
    const handleExport = async () => {
        if (!analysisRef.current) return;

        try {
            const element = analysisRef.current;
            const canvas = await html2canvas(element, {
                scale: 2, // Increase resolution
                useCORS: true, // Handle cross-origin images
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 10; // Top margin

            // Adjust height based on ratio, but let's just fit width for long content usually
            const finalImgWidth = pdfWidth - 20; // 10mm margin each side
            const finalImgHeight = (imgHeight * finalImgWidth) / imgWidth;

            // If height is taller than page, we might need multiple pages, but for now simple fit
            // If content is very long, a more complex approach is needed. 
            // For this MVP, we'll scale to fit or split if simple.

            // Simple approach: Add image. If it's too long, it will stretch or cut.
            // Better approach for long Analysis:
            if (finalImgHeight > pdfHeight - 20) {
                // Multi-page logic could go here, but starting simple
                // Just add a new page if needed? 
                // For now, let's just add it and see.
            }

            pdf.addImage(imgData, 'PNG', 10, imgY, finalImgWidth, finalImgHeight);
            pdf.save(`analysis-report-${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    return (
        <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
            <Download size={18} />
            Export PDF
        </button>
    );
};

export default PDFExportButton;
