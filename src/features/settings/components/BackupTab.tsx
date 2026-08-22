import React from "react";
import { Download, FileSpreadsheet, Layers, Trash2, AlertOctagon } from "lucide-react";
import { triggerVibration } from "../../../lib/vibrate";

interface BackupTabProps {
  postsCount: number;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onShowConfirmClear: () => void;
  onShowConfirmClearAll: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = React.memo(({
  postsCount,
  onExportJSON,
  onExportCSV,
  onShowConfirmClear,
  onShowConfirmClearAll,
}) => {
  return (
    <div className="space-y-6">
      {/* Data Export Options */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
          <Download size={14} className="text-m3-primary" />
          <span>Export Complete Database Backups</span>
        </h3>
        <p className="text-xs text-m3-on-surface-variant">
          Export your Instagram library as JSON or CSV files.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              triggerVibration("light");
              onExportJSON();
            }}
            className="flex items-center justify-center gap-2 p-3.5 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Layers size={16} className="text-m3-primary" />
            <span>Export Full JSON Backup ({postsCount} items)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerVibration("light");
              onExportCSV();
            }}
            className="flex items-center justify-center gap-2 p-3.5 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <FileSpreadsheet size={16} className="text-green-600" />
            <span>Export Spreadsheet (CSV Format)</span>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-[20px] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider">
          <AlertOctagon size={16} />
          <span>Danger Zone: Client Storage Reset</span>
        </div>
        <p className="text-xs text-m3-on-surface-variant">
          Permanently clear saved posts and reset client stores. This action is irreversible.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-red-500/10">
          <div>
            <h4 className="text-xs font-bold text-m3-on-surface">Reset Library</h4>
            <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
              Delete posts or perform a factory reset.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                triggerVibration("medium");
                onShowConfirmClear();
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-m3-surface border border-red-500/30 text-red-600 rounded-xl text-xs font-bold hover:bg-red-500/10 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Clear Posts Only
            </button>
            <button
              type="button"
              onClick={() => {
                triggerVibration("warning");
                onShowConfirmClearAll();
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Factory Reset &amp; Wipe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
