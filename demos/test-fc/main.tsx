import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'

// function App() {
// 	const [num, setNum] = useState(100)

// 	const arr =
// 		num % 2 === 0
// 			? [
// 					<li key="1"></li>,
// 					<li key="2">2</li>,
// 					<li key="3">3</li>,
// 					<>
// 						<div>7</div>
// 						<div>8</div>
// 					</>
// 			  ]
// 			: [
// 					<li key="3">3</li>,
// 					<li key="2">2</li>,
// 					<li key="1">1</li>,
// 					<>
// 						<div>7</div>
// 						<div>8</div>
// 					</>
// 			  ]

// 	return (
// 		<>
// 			<ul onClickCapture={() => setNum(num + 1)}>
// 				<li>4</li>
// 				<li>5</li>
// 				{arr}
// 			</ul>
// 			{num % 2 === 0 ? <>9</> : <>10</>}
// 		</>
// 	)
// }

// function Child() {
// 	return <span>mini-react</span>
// }

// function App() {
// 	const [num, setNum] = useState(100)

// 	return (
// 		<ul
// 			onClickCapture={() => {
// 				setNum((num) => num + 1)
// 				setNum((num) => num + 1)
// 				setNum((num) => num + 1)
// 			}}
// 		>
// 			{num}
// 		</ul>
// 	)
// }

// function App() {
// 	const [num, updateNum] = useState(0)
// 	useEffect(() => {
// 		console.log('App mount')
// 	}, [])

// 	useEffect(() => {
// 		console.log('App update')
// 	})

// 	useEffect(() => {
// 		console.log('num change create', num)
// 		return () => {
// 			console.log('num change destroy', num)
// 		}
// 	}, [num])

// 	return (
// 		<div onClick={() => updateNum(num + 1)}>
// 			{num === 0 ? <Child num={num} /> : 'noop'}
// 		</div>
// 	)
// }

// function Child({ num }) {
// 	useEffect(() => {
// 		console.log('Child mount')
// 		return () => console.log('Child unmount')
// 	}, [])

// 	useEffect(() => {
// 		return () => console.log('Child unmount', num)
// 	}, [num])

// 	return 'i am child'
// }

// function App() {
// 	const [num, update] = useState(100)
// 	return (
// 		<ul onClick={() => update(50)}>
// 			{new Array(num).fill(0).map((_, i) => {
// 				return <Child key={i}>{i}</Child>
// 			})}
// 		</ul>
// 	)
// }

// function Child({ children }) {
// 	const now = performance.now()
// 	// eslint-disable-next-line no-empty
// 	while (performance.now() - now < 4) {}
// 	return <li>{children}</li>
// }

function App() {
	const [isDel, del] = useState(false)
	const divRef = useRef(null)

	console.log('render divRef', divRef.current)

	useEffect(() => {
		console.log('useEffect divRef', divRef.current)
	}, [])

	return (
		<div ref={divRef} onClick={() => del(true)}>
			{isDel ? null : <Child />}
		</div>
	)
}

function Child() {
	return <p ref={(dom) => console.log('dom is:', dom)}>Child</p>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
