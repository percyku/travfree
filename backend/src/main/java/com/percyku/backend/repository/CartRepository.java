package com.percyku.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.percyku.backend.entity.Cart;

public interface CartRepository extends JpaRepository<Cart, String> {

	Optional<Cart> findByUserId(String userId);

	Optional<Cart> findByGuestId(String guestId);
}
