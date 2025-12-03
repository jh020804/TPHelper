import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TaskModal.css';
import { FaPaperclip, FaTrash } from 'react-icons/fa';

function TaskModal({ task, members, onClose, onSave, onDelete }) {
    const [content, setContent] = useState(task.content);
    const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
    const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '');
    const [attachments, setAttachments] = useState([]);

    useEffect(() => {
        setContent(task.content);
        setAssigneeId(task.assignee_id || '');
        setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
        
        const fetchAttachments = async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await axios.get(`http://localhost:3001/api/tasks/${task.id}/files`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAttachments(res.data.files);
            } catch (e) { console.error('Fetch files error', e); }
        };
        fetchAttachments();
    }, [task]);

    const handleSave = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const updatedFields = { content, assignee_id: assigneeId || null, due_date: dueDate || null };
        try {
            const response = await axios.patch(`http://localhost:3001/api/tasks/${task.id}`, updatedFields, { headers: { Authorization: `Bearer ${token}` } });
            onSave(response.data.task);
            onClose();
        } catch (error) { alert('수정에 실패했습니다.'); }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('token');
        try {
            const res = await axios.post(`http://localhost:3001/api/tasks/${task.id}/files`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
            });
            setAttachments(prev => [...prev, res.data.file]); 
        } catch (e) { alert('파일 업로드 실패'); }
    };

    const handleFileDelete = async (fileId) => {
        if (!window.confirm("이 파일을 삭제하시겠습니까?")) return;
        
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://localhost:3001/api/files/${fileId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAttachments(prev => prev.filter(file => file.id !== fileId));
        } catch (error) {
            console.error('파일 삭제 실패:', error);
            alert('파일 삭제에 실패했습니다.');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                    <h3>업무 수정하기</h3>
                    <label>업무 내용</label>
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} rows="4" />
                    <label>기한</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    <label>참여자</label>
                    <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                        <option value="">담당자 없음</option>
                        {members.map(member => (<option key={member.id} value={member.id}>{member.name}</option>))}
                    </select>

                    <div className="attachments-section">
                        <label style={{marginTop: 0}}>첨부파일</label>
                        <ul className="attachment-list">
                            {attachments.length > 0 ? (
                                attachments.map(file => (
                                    <li key={file.id} className="attachment-item">
                                        <a href={`http://localhost:3001/${file.file_url}`} download target="_blank" rel="noreferrer">
                                            📄 {file.original_name}
                                        </a>
                                        <button 
                                            type="button" 
                                            className="btn-file-delete"
                                            onClick={() => handleFileDelete(file.id)}
                                        >
                                            <FaTrash size={12} />
                                        </button>
                                    </li>
                                ))
                            ) : (
                                <li style={{color: '#999', fontSize: '0.9rem'}}>첨부된 파일이 없습니다.</li>
                            )}
                        </ul>
                        <label className="upload-label">
                            <FaPaperclip /> 파일 추가
                            <input type="file" style={{display:'none'}} onChange={handleFileUpload} />
                        </label>
                    </div>

                    <div className="modal-footer">
                        <div className="footer-left">
                            <button type="button" className="btn-delete" onClick={() => onDelete(task.id)}>삭제</button>
                        </div>
                        <div className="footer-right">
                            <button type="button" onClick={onClose} className="btn-cancel">취소</button>
                            <button type="submit" className="btn-save">저장</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default TaskModal;