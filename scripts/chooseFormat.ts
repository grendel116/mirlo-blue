import { askChoice } from "./askChoice";
import { DOWNLOAD_FORMATS, DownloadFormat } from "./downloadManager";

// Asks which audio format to download, then hands the choice back
export function chooseFormat(title: string, onPick: (format: DownloadFormat) => void): void {
  askChoice(title, "Choose a format", [
    ...DOWNLOAD_FORMATS.map((f) => ({ text: f.label, onPress: () => onPick(f.id) })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}