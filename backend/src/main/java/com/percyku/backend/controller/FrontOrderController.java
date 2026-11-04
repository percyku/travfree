package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.dto.OrderCreateRequest;
import com.percyku.backend.entity.Order;
import com.percyku.backend.service.OrderService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/${app.api-path}")
public class FrontOrderController {

	private final OrderService orderService;

	public FrontOrderController(OrderService orderService) {
		this.orderService = orderService;
	}

	@PostMapping("/order")
	public Map<String, Object> create(@Valid @RequestBody DataRequest<OrderCreateRequest> request) {
		Order order = orderService.create(request.data());
		Map<String, Object> body = ApiResponses.message("已建立訂單", "total", order.getTotal());
		body.put("create_at", order.getCreateAt());
		body.put("orderId", order.getId());
		return body;
	}

	/** 權限與 Hexschool 不同：此路徑在 SecurityConfig 要求 admin。 */
	@GetMapping("/orders")
	public Map<String, Object> page(@RequestParam(required = false) String page) {
		return ApiResponses.pageWithMessages("orders", orderService.page(page));
	}

	@GetMapping("/order/{id}")
	public Map<String, Object> get(@PathVariable String id) {
		return ApiResponses.of("order", orderService.get(id));
	}

	@PostMapping("/pay/{id}")
	public Map<String, Object> pay(@PathVariable String id) {
		orderService.pay(id);
		return ApiResponses.message("付款完成");
	}
}
