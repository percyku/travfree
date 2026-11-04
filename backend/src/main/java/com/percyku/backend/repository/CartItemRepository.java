package com.percyku.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.percyku.backend.entity.CartItem;

public interface CartItemRepository extends JpaRepository<CartItem, String> {

	@Query("select c from CartItem c join fetch c.product left join fetch c.coupon order by c.createdAt")
	List<CartItem> findAllWithDetails();

	@Query("select c from CartItem c join fetch c.product left join fetch c.coupon where c.id = :id")
	Optional<CartItem> findWithDetailsById(@Param("id") String id);

	Optional<CartItem> findByProductId(String productId);

	@Modifying
	@Query("delete from CartItem c where c.product.id = :productId")
	void deleteByProductId(@Param("productId") String productId);

	@Modifying
	@Query("update CartItem c set c.coupon = null where c.coupon.id = :couponId")
	void clearCoupon(@Param("couponId") String couponId);
}
