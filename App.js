import React, { useState, useRef } from "react";
import "./App.css";

function App() {
  const [content, setContent] = useState("");
  const editorRef = useRef(null);

  const handleInput = () => {
    setContent(editorRef.current.innerHTML);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h2>Realtime Collaborative Editor</h2>
        <button className="share-btn">Share</button>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <button onClick={() => document.execCommand("bold")}>B</button>
        <button onClick={() => document.execCommand("italic")}>I</button>
        <button onClick={() => document.execCommand("underline")}>U</button>
        <button onClick={() => document.execCommand("insertUnorderedList")}>
          • List
        </button>
        <button onClick={() => document.execCommand("insertOrderedList")}>
          1. List
        </button>
      </div>

      {/* Editable Area */}
      <div
        className="editor"
        contentEditable
        suppressContentEditableWarning={true}
        ref={editorRef}
        onInput={handleInput}
        placeholder="Start writing here..."
      ></div>
    </div>
  );
}

export default App;
