import React, { useState } from "react";
import { X, Printer, Calendar, CheckSquare, Sparkles, Heart, Download, Share2 } from "lucide-react";
import { MealPlanDay, ShoppingItem, Language, Currency } from "../types";
import { t } from "../utils/translations";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface PrintMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlan: MealPlanDay[];
  shoppingList: ShoppingItem[];
  language: Language;
  currency: Currency;
  userName?: string;
}

export const PrintMenuModal: React.FC<PrintMenuModalProps> = ({
  isOpen,
  onClose,
  mealPlan,
  shoppingList,
  language,
  currency,
  userName = "Familia",
}) => {
  const currentText = t[language];
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    const element = document.getElementById("printable-fridge-sheet");
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`BalkanBite_Menu_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert(
        language === "es"
          ? "Error al generar el PDF"
          : language === "bg"
          ? "Грешка при генериране на PDF"
          : "Error generating PDF"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareWhatsApp = () => {
    const text = (language === "es" ? `🛒 Mi Plan Semanal BalkanBite:\n\n` : language === "bg" ? `🛒 Моето седмично меню от BalkanBite:\n\n` : `🛒 My BalkanBite Weekly Plan:\n\n`) + 
      mealPlan.slice(0, 7).map((day, i) => {
        const date = new Date(day.date + "T00:00:00").toLocaleDateString(language === "es" ? "es-ES" : language === "bg" ? "bg-BG" : "en-US", { weekday: 'short' });
        return `📅 ${date}: ${day.lunch?.title[language] || day.lunch?.title.es || day.lunch?.title.en || '-'}`;
      }).join("\n") +
      (language === "es" ? `\n\n🍽️ Planifica tu menú con BalkanBite.` : language === "bg" ? `\n\n🍽️ Планирайте менюто си с BalkanBite.` : `\n\n🍽️ Plan your menu with BalkanBite.`);
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const getDayName = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString(language === "es" ? "es-ES" : (language === "bg" ? "bg-BG" : "en-US"), {
        weekday: "long",
        day: "numeric",
        month: "short",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      id="print-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-fridge-sheet, #printable-fridge-sheet * {
            visibility: visible;
          }
          #printable-fridge-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 15mm;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Action Bar (Hidden in Print) */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-850 no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-['Outfit']">
                {currentText.printWeeklyMenu || "Imprimir Menú de Nevera"}
              </h2>
              <p className="text-xs text-stone-400">
                {currentText.printMenuDesc || "Listo para colgar con imán en la puerta de tu nevera"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer no-print"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer no-print disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${isGenerating ? "animate-bounce" : ""}`} />
              <span>{isGenerating ? currentText.generatingPdf : currentText.downloadPdf}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{currentText.printOrSavePdf}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-stone-950/60">
          <div
            id="printable-fridge-sheet"
            className="bg-white text-stone-900 rounded-xl p-6 sm:p-8 shadow-md border border-stone-200 max-w-3xl mx-auto space-y-6 print:border-none print:shadow-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🥗</span>
                  <h1 className="text-xl font-extrabold text-stone-900 tracking-tight font-['Outfit']">
                    BalkanBite
                  </h1>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    {currentText.weeklyMenuBadge}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {currentText.healthyPlanNotice} • {currentText.householdPrefix}: {userName}
                </p>
              </div>

              <div className="text-right text-xs text-stone-500">
                <span className="font-semibold text-stone-800 block">
                  {mealPlan.length > 0 ? `${getDayName(mealPlan[0].date)}` : currentText.activeWeek}
                </span>
                <span>{currentText.goalBalancedKitchen}</span>
              </div>
            </div>

            {/* 7-Day Plan Grid */}
            <div className="space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{currentText.weekMenuTitle}</span>
              </h2>

              <div className="grid grid-cols-1 divide-y divide-stone-200 border border-stone-200 rounded-lg overflow-hidden text-xs">
                {mealPlan.slice(0, 7).map((day, idx) => (
                  <div
                    key={day.date || idx}
                    className="p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-stone-50"
                  >
                    <div className="w-32 shrink-0 font-bold text-stone-800 capitalize flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span>{getDayName(day.date)}</span>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                      <div className="p-1.5 rounded bg-stone-50 border border-stone-100">
                        <span className="text-[10px] font-bold text-stone-400 block uppercase">
                          {currentText.breakfast}
                        </span>
                        <span className="font-medium text-stone-800 truncate block">
                          {day.breakfast ? (day.breakfast.title[language] || day.breakfast.title.es || day.breakfast.title.en) : "—"}
                        </span>
                      </div>

                      <div className="p-1.5 rounded bg-stone-50 border border-stone-100">
                        <span className="text-[10px] font-bold text-stone-400 block uppercase">
                          {currentText.lunch}
                        </span>
                        <span className="font-medium text-stone-800 truncate block">
                          {day.lunch ? (day.lunch.title[language] || day.lunch.title.es || day.lunch.title.en) : "—"}
                        </span>
                      </div>

                      <div className="p-1.5 rounded bg-stone-50 border border-stone-100">
                        <span className="text-[10px] font-bold text-stone-400 block uppercase">
                          {currentText.dinner}
                        </span>
                        <span className="font-medium text-stone-800 truncate block">
                          {day.dinner ? (day.dinner.title[language] || day.dinner.title.es || day.dinner.title.en) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shopping List Section */}
            {shoppingList.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{currentText.quickShoppingListTitle}</span>
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {shoppingList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-1.5 rounded border border-dashed border-stone-300"
                    >
                      <div className="w-3.5 h-3.5 border border-stone-400 rounded-sm shrink-0" />
                      <span className="truncate text-stone-700">
                        {item.name} <span className="text-stone-400">({item.quantity} {item.unit})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer / Fridge Magnet Note */}
            <div className="border-t border-stone-200 pt-3 flex items-center justify-between text-[11px] text-stone-400">
              <span className="flex items-center gap-1">
                🧲 {currentText.hangOnFridgeNote}
              </span>
              <span>{currentText.bonAppetitSavings}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
