import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TaskModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function TaskModal({ task, members, onClose, onUpdate }) {
    // State 초기화
    const [title, setTitle] = useState(task.title || '');
    const [content, setContent] = useState(task.content || '');
    const [status, setStatus] = useState(task.status || 'To Do');
    const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '');
    const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
    const [files, setFiles] = useState([]);
    const token = localStorage.getItem('token');

    // 🚨 중요: 모달이 열리거나 task가 바뀔 때 State를 props와 동기화
    // 이 부분이 없으면 다른 카드를 눌러도 이전 데이터가 보이거나, 입력 중 사라지는 문제가 발생할 수 있습니다.
    useEffect(() => {
        setTitle(task.title || '');
        setContent(task.content || '');
        setStatus(task.status || 'To Do');
        setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
        setAssigneeId(task.assignee_id || '');
        
        fetchFiles();
        // eslint-disable-next-line
    }, [task.id]); // task.id가 바뀔 때만 실행

    const fetchFiles = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/tasks/${task.id}/files`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFiles(res.data.files);
        } catch (error) {
            console.error(error);
        }
    };

const handleSave = async () => {
        if (!title.trim()) return alert("제목을 입력해주세요.");

        try {
            // 🚨 확인: title, content, status, due_date, assignee_id 모두 전송
            await axios.patch(`${API_URL}/api/tasks/${task.id}`, 
                { 
                    title, // 🚨 수정된 제목 전송 확인
                    content, 
                    status, 
                    due_date: dueDate, 
                    assignee_id: assigneeId 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('저장되었습니다.');
            onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
            alert('저장 실패');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('정말 이 업무를 삭제하시겠습니까?')) return;
        try {
            await axios.delete(`${API_URL}/api/tasks/${task.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('삭제되었습니다.');
            onUpdate();
            onClose();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    const handleDeleteFile = async (fileId) => {
        if (!window.confirm('이 파일을 삭제하시겠습니까?')) return;
        try {
            await axios.delete(`${API_URL}/api/tasks/files/${fileId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchFiles(); 
        } catch (error) {
            console.error(error);
            alert('파일 삭제 실패');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            await axios.post(`${API_URL}/api/tasks/${task.id}/files`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}` 
                }
            });
            fetchFiles();
        } catch (error) {
            alert('파일 업로드 실패');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>업무 상세 설정</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    <div className="form-group">
                        <label>업무 제목</label>
                        <input 
                            type="text" 
                            className="title-input"
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            placeholder="업무 제목을 입력하세요"
                        />
                    </div>

                    <div className="form-group">
                        <label>상세 내용</label>
                        <textarea 
                            value={content} 
                            onChange={(e) => setContent(e.target.value)} 
                            placeholder="업무에 대한 상세 설명을 입력하세요"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>상태</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="To Do">할 일 (To Do)</option>
                                <option value="In Progress">진행 중 (In Progress)</option>
                                <option value="Done">완료 (Done)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>마감일</label>
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>담당자</label>
                        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                            <option value="">(미배정)</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="file-section">
                        <h4>첨부 파일</h4>
                        <ul className="file-list">
                            {files.map(f => (
                                <li key={f.id} className="file-item">
                                    <a href={`${API_URL}/${f.file_url}`} target="_blank" rel="noopener noreferrer">
                                        📄 {f.original_name}
                                    </a>
                                    <button 
                                        className="file-delete-btn" 
                                        onClick={() => handleDeleteFile(f.id)}
                                        title="파일 삭제"
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <input type="file" onChange={handleFileUpload} className="file-input" />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="delete-btn" onClick={handleDelete}>삭제하기</button>
                    <button className="save-btn" onClick={handleSave}>저장하기</button>
                </div>
            </div>
        </div>
    );
}

export default TaskModal;