import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { createModal } from "../../utils/modal";
import Pagination from "../../components/Pagination";
import Loading from "../../components/Loading";
import useMessage from "../../hooks/useMessage";

const { VITE_APP_API_BASE } = import.meta.env;

const ROLE_LABELS = { USER: "會員", ADMIN: "管理者" };

const isAdminUser = (user) => user.roles.includes("ADMIN");

/** 變更前的確認對話框，說明影響 */
const ConfirmModal = ({ modalRef, target, onConfirm, onCancel, submitting }) => {
  const granting = target && !isAdminUser(target);
  const title = granting ? "設為管理者" : "移除管理者";
  return (
    <div
      className="modal fade"
      tabIndex="-1"
      ref={modalRef}
      aria-labelledby="userRoleModalLabel"
      aria-hidden="true"
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5" id="userRoleModalLabel">
              {title}
            </h1>
          </div>
          <div className="modal-body">
            {target && (
              <>
                <p>
                  確定要將 <strong>{target.name}</strong>（{target.email}）
                  {granting ? "設為管理者" : "的管理者權限移除"}？
                </p>
                <p className="text-muted mb-0">
                  {granting
                    ? "管理者可以進入後台管理產品、訂單、優惠券與會員。原本的會員身分保留，仍然可以結帳。"
                    : target.roles.includes("USER")
                      ? "移除後無法進入後台，會員身分保留。"
                      : "此帳號只有管理者身分，移除後會變成一般會員。"}
                  變更立即生效，不需要重新登入。
                </p>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              取消
            </button>
            <button
              type="button"
              className={`btn ${granting ? "btn-primary" : "btn-danger"}`}
              onClick={onConfirm}
              disabled={submitting}
            >
              確定{title}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** 後台會員列表：搜尋、分頁、設定或移除管理者。自己的管理者權限不能移除 */
const AdminUsers = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useMessage();
  const myUid = useSelector((state) => state.auth.user?.uid);

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    total_pages: 0,
    current_page: 0,
    has_pre: false,
    has_next: false,
    category: "",
  });
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [target, setTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const modalRef = useRef(null);
  const confirmModalRef = useRef(null);

  const getUsers = useCallback(
    async (page = 1, q = "") => {
      try {
        setIsLoading(true);
        const res = await axios.get(`${VITE_APP_API_BASE}/api/admin/users`, {
          params: { page, ...(q && { q }) },
        });
        setUsers(res.data.users);
        setPagination(res.data.pagination);
      } catch (error) {
        if (error.response?.status === 401) {
          showError("取得資料失敗，請重新登入");
          navigate("/login");
          return;
        }
        showError(error.response?.data?.message ?? "取得會員失敗");
      } finally {
        setIsLoading(false);
      }
    },
    [showError, navigate],
  );

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    confirmModalRef.current = createModal(modalRef.current, {
      backdrop: "static",
      keyboard: false,
    });
    return () => confirmModalRef.current.dispose();
  }, []);

  const search = (e) => {
    e.preventDefault();
    const q = keyword.trim();
    setQuery(q);
    getUsers(1, q);
  };

  const changePage = (e, page) => {
    e.preventDefault();
    getUsers(page, query);
  };

  const openConfirm = (user) => {
    setTarget(user);
    confirmModalRef.current.show();
  };

  const closeConfirm = () => confirmModalRef.current.hide();

  const updateRole = async () => {
    setSubmitting(true);
    try {
      const res = await axios.put(
        `${VITE_APP_API_BASE}/api/admin/user/${target.id}`,
        { data: { is_admin: !isAdminUser(target) } },
      );
      const updated = res.data.user;
      setUsers((list) =>
        list.map((user) => (user.id === updated.id ? updated : user)),
      );
      showSuccess(res.data.message);
      closeConfirm();
    } catch (error) {
      showError(`更新失敗! ${error.response?.data?.message ?? ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ConfirmModal
        modalRef={modalRef}
        target={target}
        onConfirm={updateRole}
        onCancel={closeConfirm}
        submitting={submitting}
      />
      <form className="d-flex gap-2 mb-4" role="search" onSubmit={search}>
        <input
          type="search"
          className="form-control"
          placeholder="以 Email 或姓名搜尋"
          aria-label="搜尋會員"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button type="submit" className="btn btn-outline-primary text-nowrap">
          搜尋
        </button>
      </form>
      <div className="table-responsive mb-5">
        <table className="table align-middle">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">姓名</th>
              <th scope="col">角色</th>
              <th scope="col">註冊時間</th>
              <th scope="col">管理者權限</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isMe = user.id === myUid;
              return (
                <tr key={user.id}>
                  <td>
                    {user.email}
                    {isMe && <span className="badge text-bg-secondary ms-2">你</span>}
                  </td>
                  <td>{user.name}</td>
                  <td>
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className={`badge me-1 ${role === "ADMIN" ? "text-bg-primary" : "text-bg-light"}`}
                      >
                        {ROLE_LABELS[role] ?? role}
                      </span>
                    ))}
                  </td>
                  <td>{new Date(user.create_at * 1000).toLocaleDateString()}</td>
                  <td>
                    {isAdminUser(user) ? (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => openConfirm(user)}
                        disabled={isMe}
                        title={isMe ? "不能移除自己的管理者權限" : undefined}
                        aria-label={`移除 ${user.email} 的管理者權限`}
                      >
                        移除管理者
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openConfirm(user)}
                        aria-label={`將 ${user.email} 設為管理者`}
                      >
                        設為管理者
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && users.length === 0 && (
          <p className="text-center text-muted">
            {query ? `找不到符合「${query}」的會員` : "目前沒有會員"}
          </p>
        )}
      </div>
      <div className="d-flex justify-content-center">
        <Pagination
          pagination={pagination}
          changePage={changePage}
          loadingProductId={null}
        />
      </div>
      <Loading isLoading={isLoading} />
    </>
  );
};

export default AdminUsers;
