package com.percyku.backend.service;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.AdminUserResponse;
import com.percyku.backend.dto.PagedResult;
import com.percyku.backend.entity.Role;
import com.percyku.backend.entity.User;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.UserRepository;

/** 後台的會員列表與管理者權限。 */
@Service
@Transactional(readOnly = true)
public class MemberAdminService {

	private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

	private final UserRepository userRepository;

	public MemberAdminService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	/** q 去掉前後空白後為空時列出全部，否則以 email 或姓名部分符合（不分大小寫）。 */
	public PagedResult<AdminUserResponse> page(String page, String q) {
		String keyword = q == null ? "" : q.strip();
		return PagedResult.fetch(page, null, NEWEST_FIRST,
				pageable -> keyword.isEmpty()
						? userRepository.findAll(pageable)
						: userRepository.findByEmailContainingIgnoreCaseOrNameContainingIgnoreCase(keyword, keyword,
								pageable),
				(user, num) -> AdminUserResponse.from(user));
	}

	/**
	 * 角色每次請求都從資料庫讀取，所以變更立即生效，不需要撤銷 token。
	 *
	 * <p>不能移除自己的 ADMIN，所以循序呼叫時一定還有呼叫者這位管理者；但兩位管理者同時互相移除時，
	 * 兩邊都會看到兩位管理者。因此先鎖住所有管理者，再以<b>另一個查詢</b>計數：PostgreSQL 的 READ COMMITTED
	 * 每個查詢取新的快照，等到鎖之後的計數才看得到另一邊已提交的移除。
	 */
	@Transactional
	public User setAdmin(String callerId, String targetId, boolean admin) {
		User target = userRepository.findById(targetId).orElseThrow(() -> ApiException.notFound("找不到會員"));
		if (admin) {
			target.grantAdmin();
			return target;
		}
		if (!target.hasRole(Role.ADMIN)) {
			return target;
		}
		if (target.getId().equals(callerId)) {
			throw ApiException.badRequest("不能移除自己的管理者權限");
		}
		userRepository.lockAllByRole(Role.ADMIN);
		if (userRepository.countByRole(Role.ADMIN) <= 1) {
			throw ApiException.badRequest("至少要保留一位管理者");
		}
		target.revokeAdmin();
		return target;
	}
}
