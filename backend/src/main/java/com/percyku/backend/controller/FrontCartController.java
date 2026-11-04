package com.percyku.backend.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.CartRequest;
import com.percyku.backend.dto.CouponApplyRequest;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.dto.LineItemResponse;
import com.percyku.backend.service.CartService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/${app.api-path}")
public class FrontCartController {

	private final CartService cartService;

	public FrontCartController(CartService cartService) {
		this.cartService = cartService;
	}

	@GetMapping("/cart")
	public Map<String, Object> get() {
		return ApiResponses.withMessages("data", cartService.summary());
	}

	@PostMapping("/cart")
	public Map<String, Object> add(@Valid @RequestBody DataRequest<CartRequest> request) {
		return ApiResponses.message("已加入購物車", "data", cartService.add(request.data()));
	}

	@PutMapping("/cart/{id}")
	public Map<String, Object> update(@PathVariable String id,
			@Valid @RequestBody DataRequest<CartRequest> request) {
		LineItemResponse item = cartService.update(id, request.data());
		Map<String, Object> data = new LinkedHashMap<>();
		data.put("product_id", item.productId());
		data.put("qty", item.qty());
		return ApiResponses.message("已更新購物車", "data", data);
	}

	@DeleteMapping("/cart/{id}")
	public Map<String, Object> delete(@PathVariable String id) {
		cartService.delete(id);
		return ApiResponses.message("已刪除");
	}

	@DeleteMapping("/carts")
	public Map<String, Object> clear() {
		cartService.clear();
		return ApiResponses.message("已刪除");
	}

	@PostMapping("/coupon")
	public Map<String, Object> applyCoupon(@Valid @RequestBody DataRequest<CouponApplyRequest> request) {
		String code = request.data().code();
		long finalTotal = cartService.applyCoupon(code);
		return ApiResponses.message("已套用優惠券:" + code, "data", Map.of("final_total", finalTotal));
	}
}
