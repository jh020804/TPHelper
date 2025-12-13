import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TaskModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function TaskModal({ task, members, onClose, onUpdate }) {
    // 🚨 [수정] task가 null/undefined일 경우를 대비하여 초기 상태 방어
    const [title, setTitle] = useState(task?.title || '');
    const [content, setContent] = useState(task?.content || '');
    const [status, setStatus] = useState(task?.status || 'To Do');
    const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.split('T')[0] : '');
    // assignee_id가 null 또는 0일 경우 빈 문자열로 초기화
    const [assigneeId, setAssigneeId] = useState(task?.assignee_id || ''); 
    const [files, setFiles] = useState([]);
    const token = localStorage.getItem('token');

    // 모달이 열릴 때마다 데이터 동기화
    useEffect(() => {
        // task 객체가 유효한 경우에만 상태를 설정
        if (task && task.id) {
            setTitle(task.title || '');
            setContent(task.content || '');
            setStatus(task.status || 'To Do');
            setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
            setAssigneeId(task.assignee_id || '');
            fetchFiles();
        }
        // eslint-disable-next-line
    }, [task?.id]); // task?.id가 변경될 때만 실행

    const fetchFiles = async () => {
        if (!task || !task.id) return; // Task ID가 없으면 실행 중단
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
            const dataToSend = { 
                title: title, 
                content: content, 
                status: status,
                // 빈 문자열이면 null로 보내서 DB의 NULL 허용 필드 처리
                due_date: dueDate || null, 
                assignee_id: assigneeId || null
            };
            
            // 🚨 [핵심 수정] 1. 서버 응답을 받아야 함 (서버는 최신 Task 객체를 반환해야 함)
            const res = await axios.patch(`${API_URL}/api/tasks/${task.id}`, 
                dataToSend,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            alert('저장되었습니다.');
            
            // 🚨 [핵심 수정] 2. onUpdate 호출 시, 서버로부터 받은 최신 Task 객체를 전달
            // (서버가 Task 객체를 반환한다고 가정: TaskRoutes.js에서 응답을 수정해야 함)
            const updatedTask = res.data.task || { ...task, ...dataToSend, assignee_id: assigneeId }; 

            onUpdate(updatedTask); // ProjectPage.js의 handleModalUpdate(updatedTask) 호출
            onClose();

        } catch (error) {
            console.error("저장 실패:", error.response?.data?.message || error.message);
            alert('저장 실패: 서버 로그를 확인해주세요.');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('정말 이 업무를 삭제하시겠습니까?')) return;
        try {
            await axios.delete(`${API_URL}/api/tasks/${task.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('삭제되었습니다.');
            onUpdate({ deleted: true, taskId: task.id }); // 삭제 이벤트를 알림
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
                headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
            });
            fetchFiles();
        } catch (error) {
            alert('파일 업로드 실패');
        }
    };
    
    // task 객체가 유효하지 않으면 렌더링하지 않음 (이중 방어)
    if (!task || !task.id) return null;

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
                                // 🚨 [안정화] members 배열의 유효성 체크
                                <option key={m?.id || 'null'} value={m?.id || ''}>{m?.name || '유저 없음'}</option>
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
                                    <button className="file-delete-btn" onClick={() => handleDeleteFile(f.id)}>×</button>
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