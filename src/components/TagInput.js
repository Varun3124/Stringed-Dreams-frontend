import React, { useState, useRef, useEffect, useId } from 'react';
import { FaTimes } from 'react-icons/fa';
import { toList, tagKey, cssSwatch } from '../utils/tags';

const Swatch = ({ value }) => {
  const swatch = cssSwatch(value);
  return <span className={`color-swatch ${swatch ? '' : 'unknown'}`} style={swatch ? { background: swatch } : undefined} />;
};

/* Read-only list of chips; `swatches` adds a color dot (for color fields) */
export const TagChips = ({ values, swatches = false, className = '' }) => {
  const list = toList(values);
  if (list.length === 0) return null;
  return (
    <span className={`tag-chip-list ${className}`}>
      {list.map((value) => (
        <span key={tagKey(value)} className="tag-chip">
          {swatches && <Swatch value={value} />}
          {value}
        </span>
      ))}
    </span>
  );
};

/*
 * Tag-style input for a multi-value product field (colors, bead types).
 * Enter or comma adds a value, Backspace on an empty input removes the last one,
 * pasting "red, blue" adds both. In inline mode, `onCommit` receives the final list
 * on blur / Enter and `onCancel` fires on Escape.
 */
const TagInput = ({
  value,
  onChange,
  suggestions = [],
  swatches = false,
  placeholder = 'Add…',
  label = 'Add value',
  autoFocus = false,
  onCommit,
  onCancel,
  className = ''
}) => {
  const [draft, setDraft] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const finishedRef = useRef(false);
  const listId = useId();
  const values = toList(value);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const addValues = (text) => {
    const next = toList([...values, text]);
    setDraft('');
    if (next.length !== values.length) onChange(next);
    return next;
  };

  const removeValue = (item) => {
    onChange(values.filter((v) => tagKey(v) !== tagKey(item)));
    inputRef.current?.focus();
  };

  const commit = (finalValues) => {
    if (finishedRef.current || !onCommit) return;
    finishedRef.current = true;
    onCommit(finalValues);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (draft.trim()) addValues(draft);
      else if (e.key === 'Enter') commit(values);
    } else if (e.key === 'Backspace' && !draft && values.length > 0) {
      e.preventDefault();
      removeValue(values[values.length - 1]);
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      finishedRef.current = true;
      onCancel();
    }
  };

  const handleChange = (e) => {
    const text = e.target.value;
    const inputType = e.nativeEvent?.inputType;
    // Picking a <datalist> suggestion adds it straight away
    const pickedSuggestion = (!inputType || inputType === 'insertReplacementText')
      && suggestions.some((s) => tagKey(s) === tagKey(text));
    if (text.includes(',') || pickedSuggestion) addValues(text);
    else setDraft(text);
  };

  const handleBlur = (e) => {
    if (containerRef.current?.contains(e.relatedTarget)) return;
    const finalValues = draft.trim() ? addValues(draft) : values;
    commit(finalValues);
  };

  const available = suggestions.filter((s) => !values.some((v) => tagKey(v) === tagKey(s)));

  return (
    <div
      ref={containerRef}
      className={`tag-input ${className}`}
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((item) => (
        <span key={tagKey(item)} className="tag-chip">
          {swatches && <Swatch value={item} />}
          {item}
          <button
            type="button"
            className="tag-chip-remove"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); removeValue(item); }}
            aria-label={`Remove ${item}`}
          >
            <FaTimes size={9} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        list={listId}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={values.length === 0 ? placeholder : ''}
        aria-label={label}
      />
      <datalist id={listId}>
        {available.map((s) => <option key={tagKey(s)} value={s} />)}
      </datalist>
    </div>
  );
};

export default TagInput;
