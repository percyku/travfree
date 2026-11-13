package com.percyku.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.percyku.backend.entity.Role;
import com.percyku.backend.entity.User;

import jakarta.persistence.LockModeType;

public interface UserRepository extends JpaRepository<User, String> {

	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);

	/** Spring Data 會跳脫 q 中的 % 與 _，所以使用者輸入的萬用字元只當成一般字元。 */
	Page<User> findByEmailContainingIgnoreCaseOrNameContainingIgnoreCase(String email, String name, Pageable pageable);

	/** 鎖住擁有這個角色的帳號，依 id 排序讓同時的請求以相同順序上鎖，避免死結。 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select u from User u join u.roles r where r = :role order by u.id")
	List<User> lockAllByRole(@Param("role") Role role);

	@Query("select count(u) from User u join u.roles r where r = :role")
	long countByRole(@Param("role") Role role);
}
