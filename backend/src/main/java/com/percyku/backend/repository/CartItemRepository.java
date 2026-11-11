package com.percyku.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.percyku.backend.entity.CartItem;

public interface CartItemRepository extends JpaRepository<CartItem, String> {

	@Query("select c from CartItem c join fetch c.product left join fetch c.coupon where c.cart.id = :cartId order by c.createdAt, c.id")
	List<CartItem> findAllWithDetailsByCartId(@Param("cartId") String cartId);

	/** 只找呼叫者購物車內的品項，別台購物車的品項視為不存在。 */
	@Query("select c from CartItem c join fetch c.product left join fetch c.coupon where c.id = :id and c.cart.id = :cartId")
	Optional<CartItem> findWithDetailsByIdAndCartId(@Param("id") String id, @Param("cartId") String cartId);

	Optional<CartItem> findByCartIdAndProductId(String cartId, String productId);

	@Modifying
	@Query("delete from CartItem c where c.cart.id = :cartId")
	void deleteByCartId(@Param("cartId") String cartId);

	@Modifying
	@Query("delete from CartItem c where c.product.id = :productId")
	void deleteByProductId(@Param("productId") String productId);

	@Modifying
	@Query("update CartItem c set c.coupon = null where c.coupon.id = :couponId")
	void clearCoupon(@Param("couponId") String couponId);
}
