const VALID_PAIRS: &[(&str, &[&str])] = &[
    ("zh", &["zh", "en", "ja", "ko", "yue", "id", "th"]),
    ("en", &["zh", "en", "ja", "ko", "yue", "id", "th"]),
    ("zh_en", &["zh_en", "zh", "en", "ja", "ko", "yue", "id", "th"]),
    ("ja", &["zh", "en", "ja", "ko", "yue"]),
    ("ko", &["zh", "en", "ja", "ko", "yue"]),
    ("yue", &["zh", "en", "ja", "ko", "yue"]),
    ("id", &["zh", "en", "id"]),
    ("th", &["zh", "en", "th"]),
];

pub fn is_valid_language_pair(source: &str, target: &str) -> bool {
    VALID_PAIRS
        .iter()
        .find(|(src, _)| *src == source)
        .is_some_and(|(_, targets)| targets.contains(&target))
}

pub fn validate_language_pair(source: &str, target: &str) -> Result<(), String> {
    if is_valid_language_pair(source, target) {
        return Ok(());
    }
    Err(format!(
        "unsupported language pair: source={source}, target={target}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_en_to_zh() {
        assert!(is_valid_language_pair("en", "zh"));
    }

    #[test]
    fn accepts_auto_detect_pair() {
        assert!(is_valid_language_pair("zh_en", "zh_en"));
    }

    #[test]
    fn rejects_invalid_pair() {
        assert!(!is_valid_language_pair("ja", "id"));
    }
}
