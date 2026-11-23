export interface EditorWord {
  id: string;
  w: string;
  start: number;
  end: number;
  emph: number;
  deleted?: boolean;
}

export type CaptionPreset = "karaoke" | "hormozi" | "beast" | "minimal" | "neon";
export type TextPosition = "top" | "center" | "bottom";
export type FramingLayout = "auto_face" | "split_stack" | "blur_fit";

export interface CaptionStyleConfig {
  preset: CaptionPreset;
  fontFamily: "Montserrat" | "Anton" | "Inter" | "Poppins" | "Komika";
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  positionY: TextPosition;
  uppercase: boolean;
  maxWordsPerScreen: number;
}

export interface ClipEditorState {
  clipId: string;
  taskId: string;
  sourceUrl: string;
  videoUrl: string;
  originalStart: number;
  originalEnd: number;
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  words: EditorWord[];
  captionStyle: CaptionStyleConfig;
  layout: FramingLayout;
  isDirty: boolean;
  isRendering: boolean;
  renderProgress: number;
}

export interface ClipRemakePayload {
  start: number;
  end: number;
  caption_style: {
    preset: CaptionPreset;
    font: string;
    font_size: number;
    primary_color: string;
    highlight_color: string;
    stroke_color: string;
    stroke_width: number;
    position: TextPosition;
    uppercase: boolean;
    max_words_per_screen: number;
  };
  words: Omit<EditorWord, "id">[];
  layout: FramingLayout;
}
