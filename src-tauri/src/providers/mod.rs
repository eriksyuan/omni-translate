//! OCR / ASR / MT / LLM provider traits — implemented in later phases.

pub mod ocr {
    #[allow(dead_code)]
    pub trait OcrProvider {
        fn recognize(&self, image: &[u8]) -> Result<String, String>;
    }
}

pub mod asr {
    #[allow(dead_code)]
    pub trait AsrProvider {
        fn name(&self) -> &str;
    }
}

pub mod translation {
    #[allow(dead_code)]
    pub trait TranslationProvider {
        fn translate(&self, text: &str) -> Result<String, String>;
    }
}
