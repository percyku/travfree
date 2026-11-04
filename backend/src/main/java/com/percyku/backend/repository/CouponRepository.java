package com.percyku.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.percyku.backend.entity.Coupon;

public interface CouponRepository extends JpaRepository<Coupon, String> {

	Optional<Coupon> findByCode(String code);

	boolean existsByCode(String code);

	boolean existsByCodeAndIdNot(String code, String id);
}
