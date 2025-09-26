import React, { useEffect, useRef, useState } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { io } from 'socket.io-client'
import QuillCursors from 'quill-cursors'
import { v4 as uuidv4 } from 'uuid'

const SAVE_INTERVAL_MS = 2000

export default function Editor({ docId }) {
  const quillRef = useRef(null)
  const socketRef = useRef(null)
  const cursorsRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [presence, setPresence] = useState([])

  // create a stable user identity for this session
  const [user] = useState(() => {
    const id = uuidv4()
    const name = `User-${id.slice(0, 4)}`
    const color = stringToColour(id)
    return { userId: id, name, color }
  })

  useEffect(() => {
    // register QuillCursors module
    if (ReactQuill?.Quill && !ReactQuill.Quill.import('modules/cursors')) {
      ReactQuill.Quill.register('modules/cursors', QuillCursors)
    }
  }, [])

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:4000')
    return () => socketRef.current && socketRef.current.disconnect()
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    socket.emit('join', { docId, user })

    socket.on('load-document', (data) => {
      const editor = quillRef.current.getEditor()
      editor.setContents(data)
      editor.enable()
      setIsReady(true)
    })

    // presence updates
    socket.on('presence-update', (users) => {
      setPresence(users)
    })

    // cursor updates from others
    socket.on('cursor-update', (cursor) => {
      const cursors = cursorsRef.current
      if (!cursors) return
      const id = cursor.userId
      if (!cursors.cursors[id]) {
        cursors.createCursor(id, cursor.name, cursor.color)
      }
      cursors.moveCursor(id, cursor.range)
    })

    // incoming text changes
    socket.on('receive-changes', (delta) => {
      const editor = quillRef.current.getEditor()
      editor.updateContents(delta)
    })

    return () => {
      socket.off('load-document')
      socket.off('presence-update')
      socket.off('cursor-update')
      socket.off('receive-changes')
    }
  }, [docId])

  // send user-generated changes to server
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    const editor = quillRef.current?.getEditor()
    if (!editor) return

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return
      socket.emit('send-changes', delta)
    }

    editor.on('text-change', handler)
    return () => editor.off('text-change', handler)
  }, [isReady])

  // autosave
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const interval = setInterval(() => {
      const editor = quillRef.current?.getEditor()
      if (!editor) return
      socket.emit('save-document', editor.getContents())
    }, SAVE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [isReady])

  // cursor broadcasting
  useEffect(() => {
    const socket = socketRef.current
    const editor = quillRef.current?.getEditor()
    if (!socket || !editor) return

    const selectionHandler = (range, oldRange, source) => {
      socket.emit('cursor-change', { userId: user.userId, range, name: user.name, color: user.color })
    }

    editor.on('selection-change', selectionHandler)

    // setup cursors instance
    const quill = editor
    const cursors = quill.getModule('cursors')
    cursorsRef.current = cursors

    return () => {
      editor.off('selection-change', selectionHandler)
    }
  }, [isReady])

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <div>Document ID: <code>{docId}</code></div>
        <div className="presence">
          {presence.map((p) => (
            <div key={p.userId} className="presence-item">
              <span className="dot" style={{ background: p.color }}></span>
              <small>{p.name}</small>
            </div>
          ))}
        </div>
      </div>
      {!isReady && <div className="loading">Loading...</div>}
      <ReactQuill
        ref={quillRef}
        theme="snow"
        readOnly={!isReady}
        placeholder="Start collaborating..."
        modules={{
          toolbar: [['bold', 'italic'], ['link', 'image']],
          cursors: true
        }}
      />
    </div>
  )
}

// helper: hash a string -> color
function stringToColour(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash % 360)
  return `hsl(${h}, 70%, 45%)`
}
