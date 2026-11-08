package com.percyku.backend.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.CartRequest;
import com.percyku.backend.dto.CartSummary;
import com.percyku.backend.dto.LineItemResponse;
import com.percyku.backend.entity.CartItem;
import com.percyku.backend.entity.Coupon;
import com.percyku.backend.entity.Product;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.CartItemRepository;
import com.percyku.backend.repository.CouponRepository;
import com.percyku.backend.repository.ProductRepository;

@Service
@Transactional(readOnly = true)
public class CartService {

	private final CartItemRepository cartItemRepository;
	private final ProductRepository productRepository;
	private final CouponRepository couponRepository;

	public CartService(CartItemRepository cartItemRepository, ProductRepository productRepository,
			CouponRepository couponRepository) {
		this.cartItemRepository = cartItemRepository;
		this.productRepository = productRepository;
		this.couponRepository = couponRepository;
	}

	public CartSummary summary() {
		return CartSummary.of(cartItemRepository.findAllWithDetails().stream().map(LineItemResponse::from).toList());
	}

	/** 同一產品重複加入時累加數量：前端以 product.id 當 React key，每個產品只能有一列。 */
	@Transactional
	public LineItemResponse add(CartRequest request) {
		Product product = productRepository.findById(request.productId())
				.orElseThrow(() -> ApiException.notFound("找不到產品"));
		if (!product.isEnabled()) {
			throw ApiException.badRequest("產品已下架");
		}
		CartItem item = cartItemRepository.findByProductId(product.getId()).orElse(null);
		if (item == null) {
			item = cartItemRepository.save(new CartItem(product, request.qty()));
		} else {
			int merged = item.getQty() + request.qty();
			if (merged > CartRequest.MAX_QTY) {
				throw ApiException.badRequest("qty 不得大於 " + CartRequest.MAX_QTY);
			}
			item.setQty(merged);
		}
		return LineItemResponse.from(item);
	}

	@Transactional
	public LineItemResponse update(String id, CartRequest request) {
		CartItem item = cartItemRepository.findWithDetailsById(id)
				.orElseThrow(() -> ApiException.notFound("找不到購物車品項"));
		if (!item.getProduct().getId().equals(request.productId())) {
			throw ApiException.badRequest("product_id 與購物車品項不符");
		}
		item.setQty(request.qty());
		return LineItemResponse.from(item);
	}

	@Transactional
	public void delete(String id) {
		if (!cartItemRepository.existsById(id)) {
			throw ApiException.notFound("找不到購物車品項");
		}
		cartItemRepository.deleteById(id);
	}

	@Transactional
	public void clear() {
		cartItemRepository.deleteAllInBatch();
	}

	/** 只套用在目前購物車內的品項，之後才加入的品項不帶優惠（與 Hexschool 相同）。 */
	/** 清除購物車所有品項的優惠券。沒有套用或購物車是空的也視為成功。 */
	@Transactional
	public long removeCoupon() {
		List<CartItem> items = cartItemRepository.findAllWithDetails();
		items.forEach(item -> item.setCoupon(null));
		return CartSummary.of(items.stream().map(LineItemResponse::from).toList()).finalTotal();
	}

	@Transactional
	public long applyCoupon(String code) {
		Coupon coupon = couponRepository.findByCode(code)
				.filter(Coupon::isEnabled)
				.orElseThrow(() -> ApiException.notFound("找不到優惠券"));
		if (coupon.getDueDate() < Instant.now().getEpochSecond()) {
			throw ApiException.badRequest("優惠券已過期");
		}
		List<CartItem> items = cartItemRepository.findAllWithDetails();
		if (items.isEmpty()) {
			throw ApiException.badRequest("購物車無資料");
		}
		items.forEach(item -> item.setCoupon(coupon));
		return CartSummary.of(items.stream().map(LineItemResponse::from).toList()).finalTotal();
	}
}
