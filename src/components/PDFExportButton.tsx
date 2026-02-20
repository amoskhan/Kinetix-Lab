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

        const originalText = "Export PDF";
        const btn = document.getElementById('pdf-export-btn');
        if (btn) btn.innerText = "Generating...";

        try {
            const element = analysisRef.current;

            // Optimization: Temporarily hide scrollbars or styles that might mess up capture
            const originalStyle = element.style.cssText;
            element.style.width = `${element.scrollWidth}px`;
            element.style.height = 'auto';

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollY: -window.scrollY,
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.body.firstChild as HTMLElement; // Assuming wrapper

                    // 1. Force standard grids to be 2 columns
                    const grids = clonedDoc.querySelectorAll('[data-pdf-grid]');
                    grids.forEach(grid => {
                        grid.classList.remove('md:grid-cols-4', 'lg:grid-cols-5');
                        grid.classList.add('grid-cols-2');
                    });

                    // 2. Special Logic for Appendix Evidence (Full Width)
                    const evidenceSection = clonedDoc.querySelector('[data-pdf-section-type="evidence"]');
                    if (evidenceSection) {
                        const evidenceGrid = evidenceSection.querySelector('[data-pdf-grid]');
                        if (evidenceGrid) {
                            evidenceGrid.classList.remove('grid-cols-2');
                            evidenceGrid.classList.add('grid-cols-1'); // Full width images
                        }
                    }

                    // 3. Smart Pagination: Insert spacers to avoid cutting elements
                    // Calculate Page Height in Pixels based on A4 aspect ratio and element width
                    // A4: 210mm x 297mm. Ratio: 1.414
                    // We use the full scrollWidth as the "Content Width" mapping to (210 - margins)
                    // But jsPDF maps image to (210-20)mm wide.
                    // So: px_per_mm = element.scrollWidth / 190.

                    const A4_WIDTH_MM = 210;
                    const A4_HEIGHT_MM = 297;
                    const MARGIN_MM = 10;
                    const CONTENT_WIDTH_MM = A4_WIDTH_MM - (2 * MARGIN_MM);
                    const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - (2 * MARGIN_MM);

                    // Use the scrollWidth from the CLONED element if possible, or source
                    // clonedElement might vary if styles changed.
                    const contentWidthPx = element.scrollWidth;
                    const pxPerMm = contentWidthPx / CONTENT_WIDTH_MM;
                    const pageHeightPx = CONTENT_HEIGHT_MM * pxPerMm;

                    let currentY = 0;

                    const sections = clonedDoc.querySelectorAll('.pdf-section');

                    sections.forEach((section) => {
                        const el = section as HTMLElement;
                        const height = el.offsetHeight;

                        // Check if this section fits in the remainder of the current page
                        // Position of top of element relative to doc top
                        // We can't easily get strict offsets in clone without full layout.
                        // We must ACCUMULATE height from top using our spacer logic.
                        // Actually, since we are iterating in order...

                        // BUT: We don't know the exact Y position because previous elements might have shifted?
                        // If we iterate sequentially and track `currentY`, we simulate the layout.
                        // `currentY` starts at 0 (top of document).

                        // NOTE: This assumes `sections` appear in order and cover all vertical space (or gaps are constant).
                        // Better to traverse ALL children? 
                        // If we stick to `.pdf-section`, we assume they block-stack.
                        // Let's assume gaps are handled by margins, included in offsetHeight? No, offsetHeight is border-box.
                        // We need to account for margins.
                        const style = window.getComputedStyle(el);
                        const marginTop = parseFloat(style.marginTop);
                        const marginBottom = parseFloat(style.marginBottom);

                        // Effective bounds
                        // If we are strictly adding, the previous element ended at `currentY`.
                        // This element starts at `currentY + marginTop`?
                        // This is an approximation. 

                        // A safer way: Check `offsetTop`?
                        // In `onclone`, layout is calculated.
                        // `el.offsetTop` should be correct relative to parent?

                        const elTop = el.offsetTop;
                        const elBottom = elTop + height;

                        // Check if `elBottom` crosses a page boundary
                        const pageIndexTop = Math.floor(elTop / pageHeightPx);
                        const pageIndexBottom = Math.floor(elBottom / pageHeightPx);

                        if (pageIndexTop !== pageIndexBottom) {
                            // Element crosses a page break.
                            // Strategy:
                            // 1. If element is smaller than a page, push WHOLE element to next page.
                            // 2. If element is larger than a page (e.g. Visual Evidence), split internally.

                            if (height < pageHeightPx) {
                                // Push to next page
                                const distToNextPage = (pageIndexBottom * pageHeightPx) - elTop;
                                // Actually we want to push it such that `elTop` becomes `(pageIndexTop + 1) * pageHeightPx`.
                                // Delta = `(pageIndexTop + 1) * pageHeightPx - elTop`.

                                // Wait, if it crosses, pageIndexBottom > pageIndexTop.
                                // We want to move it to `(pageIndexTop + 1) * pageHeightPx`.
                                const spacer = ((pageIndexTop + 1) * pageHeightPx) - elTop;

                                // Apply margin-top. Note: this shifts ALL subsequent elements down!
                                // So we don't need to re-calculate everything, just let the browser reflow.
                                // BUT we need to update our `pageIndex` logic for subsequent elements?
                                // `onclone` runs once. If we change style, we need to hope `offsetTop` updates if we read it again?
                                // Browsers usually define layout properties as "live" or needing recalc.
                                // In this tight loop, force reflow might be needed.
                                // Or we just set it and trust the screenshot will see it.

                                // Problem: If we modify DOM, `el.offsetTop` for NEXT element changes.
                                // We rely on `el.offsetTop` being fresh.
                                // DOES reading `offsetTop` force reflow? YES.

                                el.style.marginTop = `${spacer + 20}px`; // Add 20px padding for safety

                            } else {
                                // Element is HUGE (Visual Evidence). Break inside.
                                // We can't push the whole thing.
                                // Iterate its internal `.pdf-item`.

                                const items = el.querySelectorAll('.pdf-item');
                                items.forEach(item => {
                                    const iEl = item as HTMLElement;
                                    const iTop = iEl.offsetTop;
                                    const iH = iEl.offsetHeight;
                                    const iBottom = iTop + iH;

                                    const pTop = Math.floor(iTop / pageHeightPx);
                                    const pBottom = Math.floor(iBottom / pageHeightPx);

                                    if (pTop !== pBottom) {
                                        // This specific item crosses the line.
                                        // Push THIS item to next page.
                                        const spacer = ((pTop + 1) * pageHeightPx) - iTop;
                                        iEl.style.marginTop = `${spacer + 20}px`;
                                    }
                                });
                            }
                        }
                    });
                }
            });

            // Restore styles
            element.style.cssText = originalStyle;

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const printableWidth = pdfWidth - (margin * 2);
            const printableHeight = pdfHeight - (margin * 2);

            const imgHeight = (canvas.height * printableWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = margin;
            let page = 1;

            // First page
            pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
            heightLeft -= printableHeight;

            // Subsequent pages
            while (heightLeft > 0) {
                position = position - printableHeight; // move image up
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
                heightLeft -= printableHeight;
                page++;
            }

            pdf.save(`kinetix-analysis-${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Is the analysis visible?');
        } finally {
            if (btn) btn.innerText = originalText;
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
