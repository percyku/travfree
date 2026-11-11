package com.percyku.backend.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.cart.CartOwner;
import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.CartRequest;
import com.percyku.backend.dto.CouponApplyRequest;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.dto.LineItemResponse;
import com.percyku.backend.service.CartService;

import jakarta.validation.Valid;

/** 每個方法的 CartOwner 決定是哪一台購物車：有 token 時是帳號的，否則依 X-Cart-Id。 */
@RestController
@RequestMapping("/api")
public class FrontCartController {

	private final CartService cartService;

	public FrontCartController(CartService cartService) {
		this.cartService = cartService;
	}

	@GetMapping("/cart")
	public Map<String, Object> get(CartOwner owner) {
		return ApiResponses.withMessages("data", cartService.summary(owner));
	}

	/** 登入後把訪客購物車併入帳號的購物車。需要登入，由 SecurityConfig 檢查。 */
	@PostMapping("/cart/merge")
	public Map<String, Object> merge(Authentication authentication,
			@RequestHeader(name = CartOwner.HEADER, required = false) String guestId) {
		return ApiResponses.withMessages("data", cartService.merge(authentication.getName(), guestId));
	}

	@PostMapping("/cart")
	public Map<String, Object> add(CartOwner owner, @Valid @RequestBody DataRequest<CartRequest> request) {
		return ApiResponses.message("已加入購物車", "data", cartService.add(owner, request.data()));
	}

	@PutMapping("/cart/{id}")
	public Map<String, Object> update(CartOwner owner, @PathVariable String id,
			@Valid @RequestBody DataRequest<CartRequest> request) {
		LineItemResponse item = cartService.update(owner, id, request.data());
		Map<String, Object> data = new LinkedHashMap<>();
		data.put("product_id", item.productId());
		data.put("qty", item.qty());
		return ApiResponses.message("已更新購物車", "data", data);
	}

	@DeleteMapping("/cart/{id}")
	public Map<String, Object> delete(CartOwner owner, @PathVariable String id) {
		cartService.delete(owner, id);
		return ApiResponses.message("已刪除");
	}

	@DeleteMapping("/carts")
	public Map<String, Object> clear(CartOwner owner) {
		cartService.clear(owner);
		return ApiResponses.message("已刪除");
	}

	@PostMapping("/coupon")
	public Map<String, Object> applyCoupon(CartOwner owner,
			@Valid @RequestBody DataRequest<CouponApplyRequest> request) {
		String code = request.data().code();
		long finalTotal = cartService.applyCoupon(owner, code);
		return ApiResponses.message("已套用優惠券:" + code, "data", Map.of("final_total", finalTotal));
	}

	@DeleteMapping("/coupon")
	public Map<String, Object> removeCoupon(CartOwner owner) {
		long finalTotal = cartService.removeCoupon(owner);
		return ApiResponses.message("已移除優惠券", "data", Map.of("final_total", finalTotal));
	}
}
