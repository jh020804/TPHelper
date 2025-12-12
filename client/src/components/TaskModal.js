import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TaskModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function TaskModal({ task, members, onClose, onUpdate }) {
    const [content, setContent] = useState(task.content);
    const [status, setStatus] = useState(task.status);
    const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '');
    const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
    const [files, setFiles] = useState([]);
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchFiles();
    }, [task.id]);

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
        try {
            await axios.patch(`${API_URL}/api/tasks/${task.id}`, 
                { content, status, due_date: dueDate, assignee_id: assigneeId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('저장되었습니다.');
            onUpdate(); // 목록 갱신
            onClose();  // 창 닫기
        } catch (error) {
            alert('저장 실패');
        }
    };

    // 🗑️ 삭제 기능 함수
    const handleDelete = async () => {
        // 1. 사용자 확인
        if (!window.confirm('정말 이 업무를 삭제하시겠습니까?\n(삭제 후에는 복구할 수 없습니다)')) {
            return;
        }

        try {
            // 2. 서버에 삭제 요청
            await axios.delete(`${API_URL}/api/tasks/${task.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // 3. 성공 시 처리
            alert('삭제되었습니다.');
            onUpdate(); // 목록 갱신 (화면에서 사라짐)
            onClose();  // 창 닫기
        } catch (error) {
            console.error(error);
            alert('삭제에 실패했습니다.');
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
            fetchFiles(); // 파일 목록 갱신
        } catch (error) {
            alert('파일 업로드 실패');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>업무 상세 수정</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    <div className="form-group">
                        <label>할 일 내용</label>
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>상태</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="To Do">할 일</option>
                                <option value="In Progress">진행 중</option>
                                <option value="Done">완료</option>
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
                            <option value="">미배정</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="file-section">
                        <h4>첨부 파일</h4>
                        <ul className="file-list">
                            {files.map(f => (
                                <li key={f.id}>
                                    <a href={`${API_URL}/${f.file_url}`} target="_blank" rel="noopener noreferrer">
                                        📄 {f.original_name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <input type="file" onChange={handleFileUpload} className="file-input" />
                    </div>
                </div>

                <div className="modal-footer">
                    {/* 🗑️ 삭제 버튼 (왼쪽) */}
                    <button className="delete-btn" onClick={handleDelete}>삭제하기</button>
                    
                    {/* 저장 버튼 (오른쪽) */}
                    <button className="save-btn" onClick={handleSave}>저장하기</button>
                </div>
            </div>
        </div>
    );
}

export default TaskModal;