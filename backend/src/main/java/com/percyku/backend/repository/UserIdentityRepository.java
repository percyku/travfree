package com.percyku.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.percyku.backend.entity.UserIdentity;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, String> {

	Optional<UserIdentity> findByProviderAndSubject(String provider, String subject);

	Optional<UserIdentity> findByUserIdAndProvider(String userId, String provider);

	/** email 以小寫保存（連結時正規化），呼叫端傳入正規化後的 email。 */
	boolean existsByEmail(String email);
}
